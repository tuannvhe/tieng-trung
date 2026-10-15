using System.Security.Claims;
using System.Text.Json;
using System.Threading.RateLimiting;
using HocTrungIt.Api.Data;
using HocTrungIt.Api.Endpoints;
using HocTrungIt.Api.Security;
using HocTrungIt.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var cfg = builder.Configuration;

// --- Cơ sở dữ liệu: SQL Server (mặc định) hoặc SQLite (chạy thử, kiểm thử) ---
var provider = cfg["Database:Provider"] ?? "SqlServer";
var connection = cfg.GetConnectionString("Default") ?? throw new InvalidOperationException("Thiếu ConnectionStrings:Default.");
builder.Services.AddDbContext<AppDb>(o =>
{
    if (provider.Equals("Sqlite", StringComparison.OrdinalIgnoreCase)) o.UseSqlite(connection);
    else o.UseSqlServer(connection);
});

// --- Đăng nhập bằng JWT ---
builder.Services.Configure<JwtOptions>(cfg.GetSection("Jwt"));
var jwt = cfg.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
if (jwt.Key.Length < 32) throw new InvalidOperationException("Jwt:Key cần ít nhất 32 ký tự. Đặt bằng biến môi trường Jwt__Key hoặc user-secrets, không ghi vào mã nguồn.");

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<TokenService>();
builder.Services.AddScoped(sp => new AccountService(sp.GetRequiredService<AppDb>(), sp.GetRequiredService<TimeProvider>(), cfg.GetValue("Auth:Iterations", Passwords.DefaultIterations)));
builder.Services.AddScoped<ProgressService>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
{
    o.MapInboundClaims = false;
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidIssuer = jwt.Issuer, ValidAudience = jwt.Issuer, IssuerSigningKey = jwt.SigningKey,
        NameClaimType = "sub", RoleClaimType = "role", ClockSkew = TimeSpan.FromSeconds(30),
    };
    // Thu hồi ngay: tài khoản bị xóa/vô hiệu hóa, đổi vai trò hoặc đổi mật khẩu thì token cũ vô hiệu
    o.Events = new JwtBearerEvents
    {
        OnTokenValidated = async ctx =>
        {
            var db = ctx.HttpContext.RequestServices.GetRequiredService<AppDb>();
            var ok = Guid.TryParse(ctx.Principal?.FindFirstValue("sub"), out var id)
                && int.TryParse(ctx.Principal?.FindFirstValue("ver"), out var ver)
                && await db.Users.AnyAsync(u => u.Id == id && !u.Disabled && u.TokenVersion == ver);
            if (!ok) ctx.Fail("Phiên đăng nhập không còn hiệu lực.");
        },
    };
});
builder.Services.AddAuthorizationBuilder().AddPolicy("Admin", p => p.RequireAuthenticatedUser().RequireRole(Roles.Admin));

// --- Giới hạn tần suất cho đăng nhập/đăng ký theo địa chỉ IP (ngoài khóa tạm theo tài khoản) ---
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter(ctx.Connection.RemoteIpAddress?.ToString() ?? "?",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = cfg.GetValue("RateLimit:AuthPerMinute", 30), Window = TimeSpan.FromMinutes(1) }));
});

var origins = cfg.GetSection("Cors:Origins").Get<string[]>() ?? [];
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
{
    if (origins.Length > 0) p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod();
}));

builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    // Khớp kiểu trường tùy chọn của TypeScript: không gửi null
    o.SerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
});

var app = builder.Build();

// Mọi lỗi nghiệp vụ trả JSON {code, message, retryAfter}; lỗi lạ không lộ chi tiết nội bộ.
app.UseExceptionHandler(h => h.Run(async ctx =>
{
    var ex = ctx.Features.Get<IExceptionHandlerFeature>()?.Error;
    if (ex is ApiException api)
    {
        ctx.Response.StatusCode = api.Status;
        if (api.RetryAfter is { } s) ctx.Response.Headers.RetryAfter = s.ToString();
        await ctx.Response.WriteAsJsonAsync(new { code = api.Code, message = api.Message, retryAfter = api.RetryAfter });
    }
    else if (ex is BadHttpRequestException or JsonException)
    {
        ctx.Response.StatusCode = 400;
        await ctx.Response.WriteAsJsonAsync(new { code = "invalid", message = "Yêu cầu không đọc được." });
    }
    else
    {
        app.Logger.LogError(ex, "Lỗi không xử lý được");
        ctx.Response.StatusCode = 500;
        await ctx.Response.WriteAsJsonAsync(new { code = "server-error", message = "Máy chủ gặp lỗi. Hãy thử lại sau." });
    }
}));

app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/api/health", () => Results.Ok(new { ok = true }));
app.MapAuth();
app.MapAdmin();
app.MapProgress();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDb>();
    if (provider.Equals("Sqlite", StringComparison.OrdinalIgnoreCase)) db.Database.EnsureCreated();
    else if (cfg.GetValue("Database:AutoMigrate", true)) db.Database.Migrate();
}

app.Run();

public partial class Program;
