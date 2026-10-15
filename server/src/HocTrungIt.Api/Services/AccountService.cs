using HocTrungIt.Api.Data;
using HocTrungIt.Api.Security;
using Microsoft.EntityFrameworkCore;

namespace HocTrungIt.Api.Services;

/// <summary>Lỗi nghiệp vụ có mã ổn định để giao diện hiển thị đúng thông báo.</summary>
public class ApiException(string code, string message, int status = 400, int? retryAfter = null) : Exception(message)
{
    public string Code { get; } = code;
    public int Status { get; } = status;
    public int? RetryAfter { get; } = retryAfter;
}

public record UserDto(string Id, string Username, string DisplayName, string Role, bool Disabled, long CreatedAt, long? LastLoginAt)
{
    public static UserDto From(User u) => new(u.Id.ToString(), u.Username, u.DisplayName, u.Role, u.Disabled, u.CreatedAt, u.LastLoginAt);
}

public class AccountService(AppDb db, TimeProvider clock, int iterations = Passwords.DefaultIterations)
{
    private const string Generic = "Sai tên đăng nhập hoặc mật khẩu.";
    private const string RegKey = "registrationOpen";
    private long Now => clock.GetUtcNow().ToUnixTimeMilliseconds();

    public async Task<bool> HasUsers() => await db.Users.AnyAsync();

    public async Task<bool> RegistrationOpen()
    {
        if (!await HasUsers()) return true;
        return (await db.AppSettings.FindAsync(RegKey))?.Value != "false";
    }

    public async Task SetRegistrationOpen(bool open)
    {
        var s = await db.AppSettings.FindAsync(RegKey);
        if (s is null) db.AppSettings.Add(new AppSetting { Key = RegKey, Value = open ? "true" : "false" });
        else s.Value = open ? "true" : "false";
        await db.SaveChangesAsync();
    }

    /// <summary>Tự đăng ký. Người đầu tiên thành quản trị viên; sau đó chỉ khi đăng ký tự do đang mở.</summary>
    public async Task<User> Register(string username, string displayName, string password)
    {
        var first = !await HasUsers();
        if (!first && !await RegistrationOpen()) throw new ApiException("registration-closed", "Đăng ký tự do đang tắt. Hãy nhờ quản trị viên tạo tài khoản.", 403);
        return await Insert(username, displayName, password, first ? Roles.Admin : Roles.Learner, selfRegistered: true);
    }

    public Task<User> CreateUser(string username, string displayName, string password, string role)
    {
        if (!Roles.IsValid(role)) throw new ApiException("invalid", "Vai trò không hợp lệ.");
        return Insert(username, displayName, password, role, selfRegistered: false);
    }

    private async Task<User> Insert(string username, string displayName, string password, string role, bool selfRegistered)
    {
        var err = Passwords.ValidateUsername(username) ?? Passwords.ValidateDisplayName(displayName) ?? Passwords.ValidatePassword(password, username);
        if (err is not null) throw new ApiException("invalid", err);
        var name = Passwords.NormalizeUsername(username);
        if (await db.Users.AnyAsync(u => u.Username == name)) throw new ApiException("username-taken", "Tên đăng nhập này đã có người dùng.", 409);
        var (hash, salt, it) = Passwords.Create(password, iterations);
        var u = new User
        {
            Id = Guid.NewGuid(), Username = name, DisplayName = displayName.Trim(), Role = role, CreatedAt = Now,
            LastLoginAt = selfRegistered ? Now : null, Hash = hash, Salt = salt, Iterations = it,
        };
        db.Users.Add(u);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException) { throw new ApiException("username-taken", "Tên đăng nhập này đã có người dùng.", 409); }
        return u;
    }

    public async Task<User> Login(string username, string password)
    {
        var name = Passwords.NormalizeUsername(username);
        var u = await db.Users.FirstOrDefaultAsync(x => x.Username == name);
        if (u is null)
        {
            // Vẫn băm một lần để thời gian phản hồi không tiết lộ tên đăng nhập có tồn tại hay không
            Passwords.Create(password, iterations);
            throw new ApiException("invalid-credentials", Generic, 401);
        }
        var wait = (int)Math.Ceiling((u.LockedUntil - Now) / 1000.0);
        if (wait > 0) throw new ApiException("locked", $"Nhập sai nhiều lần. Thử lại sau {wait} giây.", 429, wait);
        if (!Passwords.Verify(password, u.Hash, u.Salt, u.Iterations))
        {
            u.Failed++;
            var lockFor = Passwords.LockSeconds(u.Failed);
            u.LockedUntil = lockFor > 0 ? Now + lockFor * 1000L : 0;
            await db.SaveChangesAsync();
            throw lockFor > 0
                ? new ApiException("locked", $"Nhập sai nhiều lần. Thử lại sau {lockFor} giây.", 429, lockFor)
                : new ApiException("invalid-credentials", Generic, 401);
        }
        if (u.Disabled) throw new ApiException("disabled", "Tài khoản này đã bị vô hiệu hóa. Hãy liên hệ quản trị viên.", 403);
        u.Failed = 0;
        u.LockedUntil = 0;
        u.LastLoginAt = Now;
        await db.SaveChangesAsync();
        return u;
    }

    public async Task<User> Get(Guid id) => await db.Users.FindAsync(id) ?? throw new ApiException("not-found", "Không tìm thấy tài khoản.", 404);

    public async Task<List<User>> List() => await db.Users.OrderBy(u => u.CreatedAt).ToListAsync();

    public async Task ChangePassword(Guid id, string oldPassword, string newPassword)
    {
        var u = await Get(id);
        if (!Passwords.Verify(oldPassword, u.Hash, u.Salt, u.Iterations)) throw new ApiException("invalid-credentials", "Mật khẩu hiện tại không đúng.", 400);
        await SetPassword(u, newPassword);
    }

    public async Task ResetPassword(Guid userId, string newPassword) => await SetPassword(await Get(userId), newPassword);

    private async Task SetPassword(User u, string newPassword)
    {
        var err = Passwords.ValidatePassword(newPassword, u.Username);
        if (err is not null) throw new ApiException("invalid", err);
        (u.Hash, u.Salt, u.Iterations) = Passwords.Create(newPassword, iterations);
        u.Failed = 0;
        u.LockedUntil = 0;
        u.TokenVersion++; // mọi phiên đang đăng nhập bằng mật khẩu cũ bị thu hồi
        await db.SaveChangesAsync();
    }

    public async Task<User> UpdateDisplayName(Guid id, string displayName)
    {
        var err = Passwords.ValidateDisplayName(displayName);
        if (err is not null) throw new ApiException("invalid", err);
        var u = await Get(id);
        u.DisplayName = displayName.Trim();
        await db.SaveChangesAsync();
        return u;
    }

    private Task<int> ActiveAdmins(Guid? except = null) => db.Users.CountAsync(u => u.Role == Roles.Admin && !u.Disabled && u.Id != except);

    public async Task SetRole(Guid userId, string role)
    {
        if (!Roles.IsValid(role)) throw new ApiException("invalid", "Vai trò không hợp lệ.");
        var u = await Get(userId);
        if (u.Role == Roles.Admin && role != Roles.Admin && await ActiveAdmins(u.Id) == 0)
            throw new ApiException("last-admin", "Phải còn ít nhất một quản trị viên đang hoạt động.", 409);
        u.Role = role;
        u.TokenVersion++;
        await db.SaveChangesAsync();
    }

    public async Task SetDisabled(Guid userId, bool disabled)
    {
        var u = await Get(userId);
        if (disabled && u.Role == Roles.Admin && await ActiveAdmins(u.Id) == 0)
            throw new ApiException("last-admin", "Phải còn ít nhất một quản trị viên đang hoạt động.", 409);
        u.Disabled = disabled;
        u.TokenVersion++;
        await db.SaveChangesAsync();
    }

    public async Task Delete(Guid userId)
    {
        var u = await Get(userId);
        if (u.Role == Roles.Admin && !u.Disabled && await ActiveAdmins(u.Id) == 0)
            throw new ApiException("last-admin", "Phải còn ít nhất một quản trị viên đang hoạt động.", 409);
        // SQLite/SQL Server đều xóa theo khóa ngoại (cascade) nên toàn bộ tiến độ đi cùng tài khoản
        db.Users.Remove(u);
        await db.SaveChangesAsync();
    }
}
