using System.Security.Claims;
using System.Text.Json;
using HocTrungIt.Api.Data;
using HocTrungIt.Api.Security;
using HocTrungIt.Api.Services;

namespace HocTrungIt.Api.Endpoints;

public record RegisterBody(string Username, string DisplayName, string Password, bool Remember = false);
public record LoginBody(string Username, string Password, bool Remember = false);
public record ChangePasswordBody(string OldPassword, string NewPassword);
public record NewPasswordBody(string Password);
public record DisplayNameBody(string DisplayName);
public record CreateUserBody(string Username, string DisplayName, string Password, string Role);
public record RoleBody(string Role);
public record DisabledBody(bool Disabled);
public record OpenBody(bool Open);
public record DialogueBody(string Id, int Percent);
public record AuthResult(string Token, long Expires, UserDto User);

public static class Ep
{
    public static Guid Uid(this ClaimsPrincipal p) => Guid.Parse(p.FindFirstValue("sub")!);

    public static RouteGroupBuilder MapAuth(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/auth");

        g.MapGet("/status", async (AccountService acc) => Results.Ok(new { hasUsers = await acc.HasUsers(), registrationOpen = await acc.RegistrationOpen() }));

        g.MapPost("/register", async (RegisterBody b, AccountService acc, TokenService tokens) =>
        {
            var u = await acc.Register(b.Username ?? "", b.DisplayName ?? "", b.Password ?? "");
            var (token, exp) = tokens.Issue(u, b.Remember);
            return Results.Ok(new AuthResult(token, exp.ToUnixTimeMilliseconds(), UserDto.From(u)));
        }).RequireRateLimiting("auth");

        g.MapPost("/login", async (LoginBody b, AccountService acc, TokenService tokens) =>
        {
            var u = await acc.Login(b.Username ?? "", b.Password ?? "");
            var (token, exp) = tokens.Issue(u, b.Remember);
            return Results.Ok(new AuthResult(token, exp.ToUnixTimeMilliseconds(), UserDto.From(u)));
        }).RequireRateLimiting("auth");

        var me = g.MapGroup("").RequireAuthorization();
        me.MapGet("/me", async (ClaimsPrincipal p, AccountService acc) => Results.Ok(UserDto.From(await acc.Get(p.Uid()))));
        me.MapPost("/password", async (ClaimsPrincipal p, ChangePasswordBody b, AccountService acc, TokenService tokens) =>
        {
            await acc.ChangePassword(p.Uid(), b.OldPassword ?? "", b.NewPassword ?? "");
            // Mật khẩu đổi làm mọi token cũ hết hiệu lực; cấp token mới để phiên hiện tại không bị đá ra
            var u = await acc.Get(p.Uid());
            var (token, exp) = tokens.Issue(u, false);
            return Results.Ok(new AuthResult(token, exp.ToUnixTimeMilliseconds(), UserDto.From(u)));
        });
        me.MapPut("/profile", async (ClaimsPrincipal p, DisplayNameBody b, AccountService acc) =>
            Results.Ok(UserDto.From(await acc.UpdateDisplayName(p.Uid(), b.DisplayName ?? ""))));
        return g;
    }

    public static RouteGroupBuilder MapAdmin(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/admin").RequireAuthorization("Admin");

        g.MapGet("/users", async (AccountService acc) => Results.Ok((await acc.List()).Select(UserDto.From)));
        g.MapPost("/users", async (CreateUserBody b, AccountService acc) =>
            Results.Ok(UserDto.From(await acc.CreateUser(b.Username ?? "", b.DisplayName ?? "", b.Password ?? "", b.Role ?? ""))));
        g.MapPost("/users/{id:guid}/password", async (Guid id, NewPasswordBody b, AccountService acc) => { await acc.ResetPassword(id, b.Password ?? ""); return Results.NoContent(); });
        g.MapPut("/users/{id:guid}/role", async (Guid id, RoleBody b, AccountService acc) => { await acc.SetRole(id, b.Role ?? ""); return Results.NoContent(); });
        g.MapPut("/users/{id:guid}/disabled", async (Guid id, DisabledBody b, AccountService acc) => { await acc.SetDisabled(id, b.Disabled); return Results.NoContent(); });
        g.MapDelete("/users/{id:guid}", async (Guid id, AccountService acc) => { await acc.Delete(id); return Results.NoContent(); });
        g.MapGet("/users/{id:guid}/summary", async (Guid id, string today, AccountService acc, ProgressService pg) =>
        {
            await acc.Get(id);
            return Results.Ok(await pg.Summarize(id, today));
        });
        g.MapGet("/users/{id:guid}/export", async (Guid id, AccountService acc, ProgressService pg) =>
        {
            await acc.Get(id);
            return Results.Ok(await pg.Export(id));
        });
        g.MapPut("/registration", async (OpenBody b, AccountService acc) => { await acc.SetRegistrationOpen(b.Open); return Results.NoContent(); });
        return g;
    }

    public static RouteGroupBuilder MapProgress(this IEndpointRouteBuilder app)
    {
        // Mọi đường dẫn dưới /api/me chỉ đọc/ghi dữ liệu của chính người đang đăng nhập (id lấy từ token, không từ yêu cầu)
        var g = app.MapGroup("/api/me").RequireAuthorization();

        g.MapGet("/settings", async (ClaimsPrincipal p, ProgressService s) => (await s.GetSettings(p.Uid())) is { } v ? Results.Ok(v) : Results.NoContent());
        g.MapPut("/settings", async (ClaimsPrincipal p, JsonElement body, ProgressService s) => { await s.SaveSettings(p.Uid(), body); return Results.NoContent(); });

        g.MapGet("/cards", async (ClaimsPrincipal p, ProgressService s) => Results.Ok(await s.AllCards(p.Uid())));
        g.MapGet("/cards/due", async (ClaimsPrincipal p, string today, ProgressService s) => Results.Ok(await s.DueCards(p.Uid(), today)));
        g.MapGet("/cards/one", async (ClaimsPrincipal p, string @ref, ProgressService s) => (await s.GetCard(p.Uid(), @ref)) is { } c ? Results.Ok(c) : Results.NotFound());
        g.MapPost("/cards", async (ClaimsPrincipal p, CardDto c, ProgressService s) => Results.Ok(new { created = await s.CreateCardIfAbsent(p.Uid(), c) }));
        g.MapPut("/cards", async (ClaimsPrincipal p, CardDto c, ProgressService s) => { await s.SaveCard(p.Uid(), c); return Results.NoContent(); });

        g.MapPost("/reviews", async (ClaimsPrincipal p, ReviewDto r, ProgressService s) => { await s.AddReview(p.Uid(), r); return Results.NoContent(); });
        g.MapGet("/reviews", async (ClaimsPrincipal p, string from, string to, ProgressService s) => Results.Ok(await s.Reviews(p.Uid(), from, to)));

        g.MapGet("/overrides", async (ClaimsPrincipal p, ProgressService s) => Results.Ok(await s.AllOverrides(p.Uid())));
        g.MapGet("/overrides/one", async (ClaimsPrincipal p, string key, ProgressService s) => (await s.GetOverride(p.Uid(), key)) is { } o ? Results.Ok(o) : Results.NotFound());
        g.MapPut("/overrides", async (ClaimsPrincipal p, OverrideDto o, ProgressService s) => { await s.SaveOverride(p.Uid(), o); return Results.NoContent(); });

        g.MapGet("/dialogues", async (ClaimsPrincipal p, ProgressService s) => Results.Ok(await s.Dialogues(p.Uid())));
        g.MapPost("/dialogues", async (ClaimsPrincipal p, DialogueBody b, ProgressService s) => { await s.RecordDialogue(p.Uid(), b.Id, b.Percent); return Results.NoContent(); });

        g.MapGet("/videos", async (ClaimsPrincipal p, ProgressService s) => Results.Ok(await s.Videos(p.Uid())));
        g.MapPut("/videos", async (ClaimsPrincipal p, VideoDto v, ProgressService s) => { await s.SaveVideo(p.Uid(), v); return Results.NoContent(); });
        g.MapDelete("/videos/{id}", async (ClaimsPrincipal p, string id, ProgressService s) => { await s.DeleteVideo(p.Uid(), id); return Results.NoContent(); });

        g.MapGet("/papers", async (ClaimsPrincipal p, ProgressService s) => Results.Ok(await s.Papers(p.Uid())));
        g.MapGet("/papers/{id}", async (ClaimsPrincipal p, string id, ProgressService s) => (await s.GetPaper(p.Uid(), id)) is { } x ? Results.Ok(x) : Results.NotFound());
        g.MapPut("/papers", async (ClaimsPrincipal p, PaperDto d, ProgressService s) => { await s.SavePaper(p.Uid(), d); return Results.NoContent(); });
        g.MapDelete("/papers/{id}", async (ClaimsPrincipal p, string id, ProgressService s) => { await s.DeletePaper(p.Uid(), id); return Results.NoContent(); });

        g.MapGet("/exams", async (ClaimsPrincipal p, ProgressService s) => Results.Ok(await s.Exams(p.Uid())));
        g.MapPost("/exams", async (ClaimsPrincipal p, ExamDto e, ProgressService s) => { await s.AddExam(p.Uid(), e); return Results.NoContent(); });

        g.MapGet("/export", async (ClaimsPrincipal p, ProgressService s) => Results.Ok(await s.Export(p.Uid())));
        g.MapPost("/import", async (ClaimsPrincipal p, ProgressExport d, ProgressService s) => { await s.Import(p.Uid(), d); return Results.NoContent(); });
        return g;
    }
}
