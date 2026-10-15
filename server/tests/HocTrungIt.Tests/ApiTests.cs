using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Hosting;

namespace HocTrungIt.Tests;

public class ApiFactory : WebApplicationFactory<Program>
{
    private readonly string _file = Path.Combine(Path.GetTempPath(), $"htit-{Guid.NewGuid():N}.db");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("Database:Provider", "Sqlite");
        builder.UseSetting("ConnectionStrings:Default", $"Data Source={_file};Foreign Keys=True");
        builder.UseSetting("Jwt:Key", "khoa-kiem-thu-khoa-kiem-thu-khoa-kiem-thu-0123");
        builder.UseSetting("Auth:Iterations", "1000");
        builder.UseSetting("RateLimit:AuthPerMinute", "100000");
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        try { File.Delete(_file); } catch { /* không quan trọng */ }
    }
}

public class ApiTests : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private const string Pw = "mat-khau-thu-123";
    private readonly ApiFactory _f;
    public ApiTests(ApiFactory f) => _f = f;

    // Người đăng ký đầu tiên trong DB là quản trị viên: tạo sẵn để thứ tự chạy test không ảnh hưởng
    public async Task InitializeAsync() => await Admin();
    public Task DisposeAsync() => Task.CompletedTask;

    private record Auth(string Token, long Expires, JsonElement User);

    private HttpClient Client(string? token = null)
    {
        var c = _f.CreateClient();
        if (token is not null) c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return c;
    }

    private async Task<Auth> Register(string name, string pw = Pw)
    {
        var r = await Client().PostAsJsonAsync("/api/auth/register", new { username = name, displayName = name.ToUpper(), password = pw });
        r.EnsureSuccessStatusCode();
        return (await r.Content.ReadFromJsonAsync<Auth>(J))!;
    }

    private async Task<Auth> Admin() => await Login("quan.tri", Pw) ?? await Register("quan.tri");

    private async Task<Auth?> Login(string name, string pw, bool remember = false)
    {
        var r = await Client().PostAsJsonAsync("/api/auth/login", new { username = name, password = pw, remember });
        return r.IsSuccessStatusCode ? await r.Content.ReadFromJsonAsync<Auth>(J) : null;
    }

    private static readonly JsonSerializerOptions J = new(JsonSerializerDefaults.Web);
    private static string Id(Auth a) => a.User.GetProperty("id").GetString()!;
    private static string Uniq(string p) => $"{p}.{Guid.NewGuid().ToString("N")[..8]}";

    // --- Tài khoản ---

    [Fact]
    public async Task Nguoi_dau_tien_la_quan_tri_vien_nguoi_sau_la_hoc_vien()
    {
        var a = await Admin();
        Assert.Equal("admin", a.User.GetProperty("role").GetString());
        var b = await Register(Uniq("hv"));
        Assert.Equal("learner", b.User.GetProperty("role").GetString());
    }

    [Fact]
    public async Task Dang_nhap_sai_khong_lo_ten_dang_nhap_co_ton_tai_hay_khong()
    {
        var a = await Admin();
        var wrongPw = await Client().PostAsJsonAsync("/api/auth/login", new { username = "quan.tri", password = "sai-mat-khau-1" });
        var noUser = await Client().PostAsJsonAsync("/api/auth/login", new { username = "khong.co.ai", password = "sai-mat-khau-1" });
        Assert.Equal(HttpStatusCode.Unauthorized, wrongPw.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, noUser.StatusCode);
        Assert.Equal(await wrongPw.Content.ReadAsStringAsync(), await noUser.Content.ReadAsStringAsync());
        Assert.NotNull(a.Token);
    }

    [Fact]
    public async Task Sai_nam_lan_thi_khoa_va_dung_mat_khau_cung_khong_vao_duoc_trong_luc_khoa()
    {
        var name = Uniq("khoa");
        await Register(name);
        for (var i = 0; i < 4; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await Client().PostAsJsonAsync("/api/auth/login", new { username = name, password = "sai-mat-khau-1" })).StatusCode);
        var fifth = await Client().PostAsJsonAsync("/api/auth/login", new { username = name, password = "sai-mat-khau-1" });
        Assert.Equal(HttpStatusCode.TooManyRequests, fifth.StatusCode);
        var body = await fifth.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("locked", body.GetProperty("code").GetString());
        Assert.InRange(body.GetProperty("retryAfter").GetInt32(), 1, 30);
        Assert.Null(await Login(name, Pw));
    }

    [Fact]
    public async Task Mat_khau_yeu_va_ten_trung_bi_tu_choi()
    {
        Assert.Equal(HttpStatusCode.BadRequest, (await Client().PostAsJsonAsync("/api/auth/register", new { username = Uniq("yeu"), displayName = "Y", password = "123" })).StatusCode);
        var name = Uniq("trung");
        await Register(name);
        Assert.Equal(HttpStatusCode.Conflict, (await Client().PostAsJsonAsync("/api/auth/register", new { username = name.ToUpper(), displayName = "T", password = Pw })).StatusCode);
    }

    [Fact]
    public async Task Can_dang_nhap_moi_vao_duoc_du_lieu_va_token_gia_bi_tu_choi()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await Client().GetAsync("/api/me/cards")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Client("khong.phai.token").GetAsync("/api/me/cards")).StatusCode);
    }

    [Fact]
    public async Task Hoc_vien_khong_vao_duoc_trang_quan_tri()
    {
        await Admin();
        var hv = await Register(Uniq("hv"));
        Assert.Equal(HttpStatusCode.Forbidden, (await Client(hv.Token).GetAsync("/api/admin/users")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Client(hv.Token).PutAsJsonAsync("/api/admin/registration", new { open = false })).StatusCode);
    }

    [Fact]
    public async Task Doi_mat_khau_thu_hoi_token_cu_va_cap_token_moi()
    {
        var name = Uniq("doi");
        var a = await Register(name);
        var bad = await Client(a.Token).PostAsJsonAsync("/api/auth/password", new { oldPassword = "sai-mat-khau-1", newPassword = "mat-khau-moi-456" });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
        var ok = await Client(a.Token).PostAsJsonAsync("/api/auth/password", new { oldPassword = Pw, newPassword = "mat-khau-moi-456" });
        ok.EnsureSuccessStatusCode();
        var fresh = (await ok.Content.ReadFromJsonAsync<Auth>(J))!;
        Assert.Equal(HttpStatusCode.Unauthorized, (await Client(a.Token).GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Client(fresh.Token).GetAsync("/api/auth/me")).StatusCode);
        Assert.Null(await Login(name, Pw));
        Assert.NotNull(await Login(name, "mat-khau-moi-456"));
    }

    [Fact]
    public async Task Vo_hieu_hoa_thu_hoi_phien_dang_dung_va_chan_dang_nhap_lai()
    {
        var admin = await Admin();
        var name = Uniq("vh");
        var hv = await Register(name);
        (await Client(admin.Token).PutAsJsonAsync($"/api/admin/users/{Id(hv)}/disabled", new { disabled = true })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Unauthorized, (await Client(hv.Token).GetAsync("/api/me/cards")).StatusCode);
        var r = await Client().PostAsJsonAsync("/api/auth/login", new { username = name, password = Pw });
        Assert.Equal(HttpStatusCode.Forbidden, r.StatusCode);
        (await Client(admin.Token).PutAsJsonAsync($"/api/admin/users/{Id(hv)}/disabled", new { disabled = false })).EnsureSuccessStatusCode();
        Assert.NotNull(await Login(name, Pw));
    }

    [Fact]
    public async Task Khong_the_xoa_hay_ha_quyen_quan_tri_vien_cuoi_cung()
    {
        var admin = await Admin();
        var c = Client(admin.Token);
        Assert.Equal(HttpStatusCode.Conflict, (await c.DeleteAsync($"/api/admin/users/{Id(admin)}")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await c.PutAsJsonAsync($"/api/admin/users/{Id(admin)}/role", new { role = "learner" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await c.PutAsJsonAsync($"/api/admin/users/{Id(admin)}/disabled", new { disabled = true })).StatusCode);
    }

    [Fact]
    public async Task Tat_dang_ky_tu_do_chi_quan_tri_vien_moi_tao_duoc_tai_khoan()
    {
        var admin = await Admin();
        var c = Client(admin.Token);
        (await c.PutAsJsonAsync("/api/admin/registration", new { open = false })).EnsureSuccessStatusCode();
        try
        {
            Assert.Equal(HttpStatusCode.Forbidden, (await Client().PostAsJsonAsync("/api/auth/register", new { username = Uniq("tu"), displayName = "T", password = Pw })).StatusCode);
            var made = await c.PostAsJsonAsync("/api/admin/users", new { username = Uniq("do"), displayName = "D", password = Pw, role = "learner" });
            Assert.Equal(HttpStatusCode.OK, made.StatusCode);
        }
        finally { (await c.PutAsJsonAsync("/api/admin/registration", new { open = true })).EnsureSuccessStatusCode(); }
    }

    // --- Tiến độ ---

    private static object Card(string r, string due = "2026-01-10", int interval = 0) =>
        new { @ref = r, ease = 2.5, interval, repetitions = 0, due, lapses = 0, createdAt = 1000 };

    [Fact]
    public async Task The_chi_tao_mot_lan_va_du_lieu_tach_rieng_tung_nguoi()
    {
        var a = await Register(Uniq("a"));
        var b = await Register(Uniq("b"));
        var ca = Client(a.Token);
        var first = await (await ca.PostAsJsonAsync("/api/me/cards", Card("hsk:hsk1-0001"))).Content.ReadFromJsonAsync<JsonElement>();
        var again = await (await ca.PostAsJsonAsync("/api/me/cards", Card("hsk:hsk1-0001"))).Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(first.GetProperty("created").GetBoolean());
        Assert.False(again.GetProperty("created").GetBoolean());
        Assert.Single(await ca.GetFromJsonAsync<JsonElement[]>("/api/me/cards") ?? []);
        Assert.Empty(await Client(b.Token).GetFromJsonAsync<JsonElement[]>("/api/me/cards") ?? []);
        Assert.Equal(HttpStatusCode.NotFound, (await Client(b.Token).GetAsync("/api/me/cards/one?ref=hsk:hsk1-0001")).StatusCode);
    }

    [Fact]
    public async Task The_den_han_loc_theo_ngay_va_cap_nhat_duoc()
    {
        var a = await Register(Uniq("han"));
        var c = Client(a.Token);
        await c.PostAsJsonAsync("/api/me/cards", Card("hsk:x1", "2026-01-05"));
        await c.PostAsJsonAsync("/api/me/cards", Card("hsk:x2", "2026-01-20"));
        var due = await c.GetFromJsonAsync<JsonElement[]>("/api/me/cards/due?today=2026-01-10");
        Assert.Single(due!);
        Assert.Equal("hsk:x1", due![0].GetProperty("ref").GetString());
        (await c.PutAsJsonAsync("/api/me/cards", Card("hsk:x2", "2026-01-09", 3))).EnsureSuccessStatusCode();
        Assert.Equal(2, (await c.GetFromJsonAsync<JsonElement[]>("/api/me/cards/due?today=2026-01-10"))!.Length);
    }

    [Fact]
    public async Task Du_lieu_sai_bi_tu_choi()
    {
        var c = Client((await Register(Uniq("sai"))).Token);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/me/reviews", new { @ref = "hsk:x", grade = 9, day = "2026-01-01", at = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/me/reviews", new { @ref = "hsk:x", grade = 2, day = "hom-nay", at = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/me/cards", Card("hsk:x", "khong-phai-ngay"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/me/exams", new { kind = "level", level = 9, correct = 1, total = 2, percent = 50, passed = false, at = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/me/dialogues", new { id = "d1", percent = 500 })).StatusCode);
    }

    [Fact]
    public async Task Nhat_ky_on_hoi_thoai_va_ket_qua_thi()
    {
        var c = Client((await Register(Uniq("nk"))).Token);
        (await c.PostAsJsonAsync("/api/me/reviews", new { @ref = "hsk:x", grade = 2, day = "2026-01-10", at = 5 })).EnsureSuccessStatusCode();
        (await c.PostAsJsonAsync("/api/me/reviews", new { @ref = "hsk:x", grade = 0, day = "2026-02-10", at = 6 })).EnsureSuccessStatusCode();
        Assert.Single((await c.GetFromJsonAsync<JsonElement[]>("/api/me/reviews?from=2026-01-01&to=2026-01-31"))!);

        await c.PostAsJsonAsync("/api/me/dialogues", new { id = "d1", percent = 60 });
        await c.PostAsJsonAsync("/api/me/dialogues", new { id = "d1", percent = 40 });
        var d = (await c.GetFromJsonAsync<JsonElement[]>("/api/me/dialogues"))!.Single();
        Assert.Equal(60, d.GetProperty("best").GetInt32());
        Assert.Equal(2, d.GetProperty("attempts").GetInt32());

        (await c.PostAsJsonAsync("/api/me/exams", new { kind = "level", level = 1, correct = 25, total = 30, percent = 83, passed = true, at = 9 })).EnsureSuccessStatusCode();
        Assert.Single((await c.GetFromJsonAsync<JsonElement[]>("/api/me/exams"))!);
    }

    [Fact]
    public async Task Phan_nguoi_dung_sua_va_cai_dat_luu_dung_hinh_dang_cua_giao_dien()
    {
        var c = Client((await Register(Uniq("ov"))).Token);
        Assert.Equal(HttpStatusCode.NoContent, (await c.GetAsync("/api/me/settings")).StatusCode);
        (await c.PutAsJsonAsync("/api/me/settings", new { mode = "full", theme = "dark", newCardsPerDay = 20 })).EnsureSuccessStatusCode();
        Assert.Equal("dark", (await c.GetFromJsonAsync<JsonElement>("/api/me/settings")).GetProperty("theme").GetString());

        (await c.PutAsJsonAsync("/api/me/overrides", new Dictionary<string, object?> { ["key"] = "hsk:a", ["meaning_vi"] = "xin chào", ["han_viet"] = "nhĩ hảo", ["reviewed"] = true, ["updatedAt"] = 7 })).EnsureSuccessStatusCode();
        var o = await c.GetFromJsonAsync<JsonElement>("/api/me/overrides/one?key=hsk:a");
        Assert.Equal("xin chào", o.GetProperty("meaning_vi").GetString());
        Assert.Equal("nhĩ hảo", o.GetProperty("han_viet").GetString());
    }

    [Fact]
    public async Task Xuat_roi_nhap_lai_giu_nguyen_tien_do_va_nhap_loi_thi_khong_mat_du_lieu_cu()
    {
        var a = Client((await Register(Uniq("xa"))).Token);
        await a.PostAsJsonAsync("/api/me/cards", Card("hsk:e1"));
        await a.PostAsJsonAsync("/api/me/reviews", new { @ref = "hsk:e1", grade = 3, day = "2026-01-10", at = 5 });
        await a.PostAsJsonAsync("/api/me/dialogues", new { id = "d9", percent = 80 });
        var dump = await a.GetStringAsync("/api/me/export");

        var b = Client((await Register(Uniq("xb"))).Token);
        (await b.PostAsync("/api/me/import", new StringContent(dump, System.Text.Encoding.UTF8, "application/json"))).EnsureSuccessStatusCode();
        Assert.Single((await b.GetFromJsonAsync<JsonElement[]>("/api/me/cards"))!);
        Assert.Single((await b.GetFromJsonAsync<JsonElement[]>("/api/me/dialogues"))!);

        var broken = dump.Replace("\"version\":1", "\"version\":2");
        Assert.Equal(HttpStatusCode.BadRequest, (await b.PostAsync("/api/me/import", new StringContent(broken, System.Text.Encoding.UTF8, "application/json"))).StatusCode);
        Assert.Single((await b.GetFromJsonAsync<JsonElement[]>("/api/me/cards"))!);
    }

    [Fact]
    public async Task Xoa_tai_khoan_xoa_luon_tien_do_va_tom_tat_cho_quan_tri_vien()
    {
        var admin = await Admin();
        var hv = await Register(Uniq("xoa"));
        var c = Client(hv.Token);
        await c.PostAsJsonAsync("/api/me/cards", Card("hsk:z1", "2026-01-01", 30));
        await c.PostAsJsonAsync("/api/me/reviews", new { @ref = "hsk:z1", grade = 2, day = "2026-01-10", at = 1 });
        var s = await Client(admin.Token).GetFromJsonAsync<JsonElement>($"/api/admin/users/{Id(hv)}/summary?today=2026-01-10");
        Assert.Equal(1, s.GetProperty("learned").GetInt32());
        Assert.Equal(1, s.GetProperty("mature").GetInt32());
        Assert.Equal(1, s.GetProperty("reviewedToday").GetInt32());
        Assert.Equal(1, s.GetProperty("streak").GetInt32());

        (await Client(admin.Token).DeleteAsync($"/api/admin/users/{Id(hv)}")).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.GetAsync("/api/me/cards")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Client(admin.Token).GetAsync($"/api/admin/users/{Id(hv)}/export")).StatusCode);
    }
}

public class VideoTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _f;
    public VideoTests(ApiFactory f) => _f = f;

    private static object Vid(string id, string videoId = "dQw4w9WgXcQ", string title = "Bài nghe", int level = 2, int start = 0) =>
        new { id, videoId, title, note = "ghi chú", level, start, createdAt = 1000 };

    private async Task<HttpClient> NewUser(string prefix)
    {
        var c = _f.CreateClient();
        var name = $"{prefix}.{Guid.NewGuid().ToString("N")[..8]}";
        var r = await c.PostAsJsonAsync("/api/auth/register", new { username = name, displayName = "V", password = "mat-khau-thu-123" });
        r.EnsureSuccessStatusCode();
        var token = (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;
        c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return c;
    }

    [Fact]
    public async Task Luu_sua_xoa_video_va_moi_nguoi_chi_thay_video_cua_minh()
    {
        var a = await NewUser("va");
        var b = await NewUser("vb");
        (await a.PutAsJsonAsync("/api/me/videos", Vid("v1"))).EnsureSuccessStatusCode();
        (await a.PutAsJsonAsync("/api/me/videos", Vid("v1", title: "Đã đổi tên", level: 3, start: 90))).EnsureSuccessStatusCode();
        var list = (await a.GetFromJsonAsync<JsonElement[]>("/api/me/videos"))!;
        Assert.Single(list);
        Assert.Equal("Đã đổi tên", list[0].GetProperty("title").GetString());
        Assert.Equal(90, list[0].GetProperty("start").GetInt32());

        Assert.Empty((await b.GetFromJsonAsync<JsonElement[]>("/api/me/videos"))!);
        // B xóa id trùng của A không ảnh hưởng A
        (await b.DeleteAsync("/api/me/videos/v1")).EnsureSuccessStatusCode();
        Assert.Single((await a.GetFromJsonAsync<JsonElement[]>("/api/me/videos"))!);
        (await a.DeleteAsync("/api/me/videos/v1")).EnsureSuccessStatusCode();
        Assert.Empty((await a.GetFromJsonAsync<JsonElement[]>("/api/me/videos"))!);
    }

    [Fact]
    public async Task Ma_video_gia_hoac_du_lieu_sai_bi_tu_choi()
    {
        var a = await NewUser("vc");
        foreach (var bad in new[]
        {
            Vid("x1", videoId: "<script>alert(1)"), Vid("x2", videoId: "short"), Vid("x3", title: ""), Vid("x4", level: 7), Vid("x5", start: -1), Vid("x6", title: new string('a', 201)),
        })
            Assert.Equal(HttpStatusCode.BadRequest, (await a.PutAsJsonAsync("/api/me/videos", bad)).StatusCode);
        Assert.Empty((await a.GetFromJsonAsync<JsonElement[]>("/api/me/videos"))!);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _f.CreateClient().GetAsync("/api/me/videos")).StatusCode);
    }

    [Fact]
    public async Task Video_di_theo_xuat_nhap_tien_do()
    {
        var a = await NewUser("vd");
        await a.PutAsJsonAsync("/api/me/videos", Vid("e1"));
        var dump = await a.GetStringAsync("/api/me/export");
        var b = await NewUser("ve");
        (await b.PostAsync("/api/me/import", new StringContent(dump, System.Text.Encoding.UTF8, "application/json"))).EnsureSuccessStatusCode();
        Assert.Single((await b.GetFromJsonAsync<JsonElement[]>("/api/me/videos"))!);
    }
}

public class VideoMarkTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _f;
    public VideoMarkTests(ApiFactory f) => _f = f;

    private async Task<HttpClient> NewUser()
    {
        var c = _f.CreateClient();
        var r = await c.PostAsJsonAsync("/api/auth/register", new { username = $"mk.{Guid.NewGuid().ToString("N")[..8]}", displayName = "M", password = "mat-khau-thu-123" });
        r.EnsureSuccessStatusCode();
        c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!);
        return c;
    }

    private static object Vid(object[] marks) => new { id = "m1", videoId = "dQw4w9WgXcQ", title = "T", note = "", level = 1, start = 0, createdAt = 1, marks };

    [Fact]
    public async Task Moc_thoi_gian_luu_doc_lai_va_di_theo_xuat_nhap()
    {
        var a = await NewUser();
        (await a.PutAsJsonAsync("/api/me/videos", Vid([new { t = 75, note = "câu cần nghe lại" }, new { t = 5, note = "" }]))).EnsureSuccessStatusCode();
        var v = (await a.GetFromJsonAsync<JsonElement[]>("/api/me/videos"))!.Single();
        var marks = v.GetProperty("marks").EnumerateArray().ToList();
        Assert.Equal(2, marks.Count);
        Assert.Equal(75, marks[0].GetProperty("t").GetInt32());
        Assert.Equal("câu cần nghe lại", marks[0].GetProperty("note").GetString());

        var dump = await a.GetStringAsync("/api/me/export");
        var b = await NewUser();
        (await b.PostAsync("/api/me/import", new StringContent(dump, System.Text.Encoding.UTF8, "application/json"))).EnsureSuccessStatusCode();
        Assert.Equal(2, (await b.GetFromJsonAsync<JsonElement[]>("/api/me/videos"))!.Single().GetProperty("marks").GetArrayLength());
    }

    [Fact]
    public async Task Moc_sai_hoac_qua_nhieu_bi_tu_choi()
    {
        var a = await NewUser();
        Assert.Equal(HttpStatusCode.BadRequest, (await a.PutAsJsonAsync("/api/me/videos", Vid([new { t = -1, note = "x" }]))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await a.PutAsJsonAsync("/api/me/videos", Vid([new { t = 1, note = new string('a', 201) }]))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await a.PutAsJsonAsync("/api/me/videos", Vid(Enumerable.Range(0, 51).Select(i => (object)new { t = i, note = "" }).ToArray()))).StatusCode);
        Assert.Empty((await a.GetFromJsonAsync<JsonElement[]>("/api/me/videos"))!);
    }
}

public class MockExamTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _f;
    public MockExamTests(ApiFactory f) => _f = f;

    private async Task<HttpClient> NewUser()
    {
        var c = _f.CreateClient();
        var r = await c.PostAsJsonAsync("/api/auth/register", new { username = $"mo.{Guid.NewGuid().ToString("N")[..8]}", displayName = "M", password = "mat-khau-thu-123" });
        r.EnsureSuccessStatusCode();
        c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!);
        return c;
    }

    private static object Exam(string kind = "mock", int level = 2, string? detail = "[{\"skill\":\"listening\",\"score\":80}]") =>
        new { kind, level, correct = 50, total = 60, percent = 83, passed = true, at = 5, detail };

    [Fact]
    public async Task Ket_qua_thi_thu_luu_kem_diem_tung_phan_va_di_theo_xuat_nhap()
    {
        var a = await NewUser();
        (await a.PostAsJsonAsync("/api/me/exams", Exam())).EnsureSuccessStatusCode();
        var e = (await a.GetFromJsonAsync<JsonElement[]>("/api/me/exams"))!.Single();
        Assert.Equal("mock", e.GetProperty("kind").GetString());
        Assert.Contains("listening", e.GetProperty("detail").GetString());

        var dump = await a.GetStringAsync("/api/me/export");
        var b = await NewUser();
        (await b.PostAsync("/api/me/import", new StringContent(dump, System.Text.Encoding.UTF8, "application/json"))).EnsureSuccessStatusCode();
        Assert.Contains("listening", (await b.GetFromJsonAsync<JsonElement[]>("/api/me/exams"))!.Single().GetProperty("detail").GetString());
    }

    [Fact]
    public async Task Thi_cap_6_duoc_chap_nhan_con_loai_thi_la_hoac_chi_tiet_qua_dai_bi_tu_choi()
    {
        var a = await NewUser();
        Assert.Equal(HttpStatusCode.NoContent, (await a.PostAsJsonAsync("/api/me/exams", Exam("level", 6, null))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await a.PostAsJsonAsync("/api/me/exams", Exam("khac"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await a.PostAsJsonAsync("/api/me/exams", Exam(detail: new string('x', 2001)))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await a.PostAsJsonAsync("/api/me/exams", Exam(level: 7))).StatusCode);
    }
}

public class PaperTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _f;
    public PaperTests(ApiFactory f) => _f = f;

    private async Task<HttpClient> NewUser(string prefix)
    {
        var c = _f.CreateClient();
        var r = await c.PostAsJsonAsync("/api/auth/register", new { username = $"{prefix}.{Guid.NewGuid().ToString("N")[..8]}", displayName = "P", password = "mat-khau-thu-123" });
        r.EnsureSuccessStatusCode();
        c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!);
        return c;
    }
    private static object Paper(string id, string json = "{\"title\":\"t\"}", int level = 2) => new { id, title = "Đề " + id, level, savedAt = 1000, json };

    [Fact]
    public async Task Luu_lay_xoa_de_va_moi_nguoi_chi_thay_de_cua_minh()
    {
        var a = await NewUser("pa");
        var b = await NewUser("pb");
        (await a.PutAsJsonAsync("/api/me/papers", Paper("d1"))).EnsureSuccessStatusCode();
        var list = (await a.GetFromJsonAsync<JsonElement[]>("/api/me/papers"))!;
        Assert.Single(list);
        Assert.False(list[0].TryGetProperty("json", out _));
        Assert.Equal("{\"title\":\"t\"}", (await a.GetFromJsonAsync<JsonElement>("/api/me/papers/d1")).GetProperty("json").GetString());
        Assert.Empty((await b.GetFromJsonAsync<JsonElement[]>("/api/me/papers"))!);
        Assert.Equal(System.Net.HttpStatusCode.NotFound, (await b.GetAsync("/api/me/papers/d1")).StatusCode);
        (await a.DeleteAsync("/api/me/papers/d1")).EnsureSuccessStatusCode();
        Assert.Empty((await a.GetFromJsonAsync<JsonElement[]>("/api/me/papers"))!);
    }

    [Fact]
    public async Task De_sai_json_qua_lon_hoac_vuot_so_luong_bi_tu_choi()
    {
        var a = await NewUser("pc");
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, (await a.PutAsJsonAsync("/api/me/papers", Paper("x", "khong phai json"))).StatusCode);
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, (await a.PutAsJsonAsync("/api/me/papers", Paper("x", level: 7))).StatusCode);
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, (await a.PutAsJsonAsync("/api/me/papers", Paper("x", "\"" + new string('a', 300_001) + "\""))).StatusCode);
        for (var i = 0; i < 30; i++) (await a.PutAsJsonAsync("/api/me/papers", Paper("p" + i))).EnsureSuccessStatusCode();
        Assert.Equal(System.Net.HttpStatusCode.RequestEntityTooLarge, (await a.PutAsJsonAsync("/api/me/papers", Paper("extra"))).StatusCode);
        (await a.PutAsJsonAsync("/api/me/papers", Paper("p0"))).EnsureSuccessStatusCode(); // ghi đè vẫn được
    }

    [Fact]
    public async Task Xuat_nhap_giu_lai_de()
    {
        var a = await NewUser("pd");
        (await a.PutAsJsonAsync("/api/me/papers", Paper("e1"))).EnsureSuccessStatusCode();
        var exp = await a.GetFromJsonAsync<JsonElement>("/api/me/export");
        Assert.Equal(1, exp.GetProperty("papers").GetArrayLength());
        (await a.DeleteAsync("/api/me/papers/e1")).EnsureSuccessStatusCode();
        (await a.PostAsJsonAsync("/api/me/import", exp)).EnsureSuccessStatusCode();
        Assert.Single((await a.GetFromJsonAsync<JsonElement[]>("/api/me/papers"))!);
    }
}

public class VideoProgressTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _f;
    public VideoProgressTests(ApiFactory f) => _f = f;

    [Fact]
    public async Task Luu_vi_tri_da_xem_va_tu_choi_gia_tri_sai()
    {
        var c = _f.CreateClient();
        var r = await c.PostAsJsonAsync("/api/auth/register", new { username = $"vp.{Guid.NewGuid().ToString("N")[..8]}", displayName = "V", password = "mat-khau-thu-123" });
        r.EnsureSuccessStatusCode();
        c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!);
        object V(int pos, int dur) => new { id = "v1", videoId = "dQw4w9WgXcQ", title = "t", note = "", level = 1, start = 0, createdAt = 1000, position = pos, duration = dur };
        (await c.PutAsJsonAsync("/api/me/videos", V(0, 0))).EnsureSuccessStatusCode();
        (await c.PutAsJsonAsync("/api/me/videos", V(125, 340))).EnsureSuccessStatusCode();
        var list = (await c.GetFromJsonAsync<JsonElement[]>("/api/me/videos"))!;
        Assert.Equal(125, list[0].GetProperty("position").GetInt32());
        Assert.Equal(340, list[0].GetProperty("duration").GetInt32());
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, (await c.PutAsJsonAsync("/api/me/videos", V(-1, 10))).StatusCode);
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, (await c.PutAsJsonAsync("/api/me/videos", V(10, 999999))).StatusCode);
    }
}
