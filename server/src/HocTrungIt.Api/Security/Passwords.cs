using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace HocTrungIt.Api.Security;

/// <summary>Băm mật khẩu PBKDF2-SHA256, cùng tham số với bản chạy trên trình duyệt.</summary>
public static partial class Passwords
{
    public const int DefaultIterations = 210_000;
    private const int SaltBytes = 16, HashBytes = 32;

    public static (byte[] Hash, byte[] Salt, int Iterations) Create(string password, int iterations = DefaultIterations)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltBytes);
        return (Derive(password, salt, iterations), salt, iterations);
    }

    public static bool Verify(string password, byte[] hash, byte[] salt, int iterations) =>
        CryptographicOperations.FixedTimeEquals(Derive(password, salt, iterations), hash);

    private static byte[] Derive(string password, byte[] salt, int iterations) =>
        Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(password.Normalize(NormalizationForm.FormKC)), salt, iterations, HashAlgorithmName.SHA256, HashBytes);

    public static string NormalizeUsername(string u) => u.Trim().ToLowerInvariant();

    public static string? ValidateUsername(string username)
    {
        var u = NormalizeUsername(username);
        if (u.Length is < 3 or > 32) return "Tên đăng nhập dài từ 3 đến 32 ký tự.";
        if (!UsernameRx().IsMatch(u)) return "Tên đăng nhập chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới và gạch ngang.";
        return null;
    }

    public static string? ValidatePassword(string password, string username = "")
    {
        if (password.Length < 8) return "Mật khẩu cần ít nhất 8 ký tự.";
        if (password.Length > 128) return "Mật khẩu tối đa 128 ký tự.";
        if (username != "" && password.Equals(NormalizeUsername(username), StringComparison.OrdinalIgnoreCase)) return "Mật khẩu không được trùng tên đăng nhập.";
        if (password.All(c => c == password[0])) return "Mật khẩu không được lặp một ký tự.";
        if (Weak.Contains(password.ToLowerInvariant())) return "Mật khẩu này quá dễ đoán.";
        return null;
    }

    public static string? ValidateDisplayName(string name) =>
        name.Trim().Length is < 1 or > 40 ? "Tên hiển thị dài từ 1 đến 40 ký tự." : null;

    /// <summary>5 lần đầu tự do, sau đó 30 giây nhân đôi mỗi lần, tối đa 15 phút.</summary>
    public static int LockSeconds(int failed) => failed < 5 ? 0 : (int)Math.Min(900, 30 * Math.Pow(2, failed - 5));

    private static readonly HashSet<string> Weak = ["12345678", "123456789", "password", "matkhau123", "11111111"];

    [GeneratedRegex("^[a-z0-9._-]+$")]
    private static partial Regex UsernameRx();
}
