using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using HocTrungIt.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HocTrungIt.Api.Services;

// Hình dạng JSON khớp từng interface trong src/types và src/lib/storage.ts của giao diện.
public record CardDto(string Ref, double Ease, int Interval, int Repetitions, string Due, int Lapses, long CreatedAt);
public record ReviewDto(long? Id, string Ref, int Grade, string Day, long At);
public record OverrideDto(string Key,
    [property: JsonPropertyName("meaning_vi")] string? MeaningVi,
    [property: JsonPropertyName("han_viet")] string? HanViet,
    string? Note, bool? Reviewed, long UpdatedAt);
public record DialogueDto(string Id, int Best, int Attempts, long Last);
public record ExamDto(long? Id, string Kind, int Level, int Correct, int Total, int Percent, bool Passed, long At, string? Detail = null);
public record ProgressExport(int Version, string ExportedAt, JsonElement? Settings, List<CardDto> Cards, List<ReviewDto> Log,
    List<OverrideDto> Overrides, List<ExamDto>? Exams, List<DialogueDto>? Dialogues, List<VideoDto>? Videos = null, List<PaperDto>? Papers = null);
public record MarkDto(int T, string Note);
public record VideoDto(string Id, string VideoId, string Title, string Note, int Level, int Start, long CreatedAt, long? LastWatchedAt, List<MarkDto>? Marks = null, int Position = 0, int Duration = 0);
public record PaperMetaDto(string Id, string Title, int Level, long SavedAt);
public record PaperDto(string Id, string Title, int Level, long SavedAt, string Json);
public record Summary(int Learned, int Mature, int Due, int ReviewedToday, int Streak);

public static partial class Check
{
    [GeneratedRegex(@"^\d{4}-\d{2}-\d{2}$")] private static partial Regex DayRx();
    public static bool Day(string? d) => d is not null && DayRx().IsMatch(d);
    [GeneratedRegex(@"^[A-Za-z0-9_-]{11}$")] private static partial Regex VideoRx();
    public static bool VideoId(string? v) => v is not null && VideoRx().IsMatch(v);
    public static bool Ref(string? r) => !string.IsNullOrWhiteSpace(r) && r.Length <= 64;
}

public class ProgressService(AppDb db, TimeProvider clock)
{
    public const int MatureInterval = 21;
    public const int MaxImportRows = 500_000;

    private static CardDto ToDto(Card c) => new(c.Ref, c.Ease, c.Interval, c.Repetitions, c.Due, c.Lapses, c.CreatedAt);
    private static Card ToEntity(Guid uid, CardDto c) => new() { UserId = uid, Ref = c.Ref, Ease = c.Ease, Interval = c.Interval, Repetitions = c.Repetitions, Due = c.Due, Lapses = c.Lapses, CreatedAt = c.CreatedAt };

    private static void Validate(CardDto c)
    {
        if (!Check.Ref(c.Ref) || !Check.Day(c.Due) || c.Ease is < 1.0 or > 10 || c.Interval is < 0 or > 36500 || c.Repetitions < 0 || c.Lapses < 0)
            throw new ApiException("invalid", "Dữ liệu thẻ không hợp lệ.");
    }

    // --- Cài đặt ---
    public async Task<JsonElement?> GetSettings(Guid uid)
    {
        var s = await db.UserSettings.FindAsync(uid);
        return s is null ? null : JsonDocument.Parse(s.Json).RootElement.Clone();
    }

    public async Task SaveSettings(Guid uid, JsonElement json)
    {
        var raw = json.GetRawText();
        if (json.ValueKind != JsonValueKind.Object || raw.Length > 20_000) throw new ApiException("invalid", "Cài đặt không hợp lệ.");
        var s = await db.UserSettings.FindAsync(uid);
        if (s is null) db.UserSettings.Add(new UserSettings { UserId = uid, Json = raw });
        else s.Json = raw;
        await db.SaveChangesAsync();
    }

    // --- Thẻ ---
    public async Task<CardDto?> GetCard(Guid uid, string r) => (await db.Cards.FindAsync(uid, r)) is { } c ? ToDto(c) : null;

    public async Task<bool> CreateCardIfAbsent(Guid uid, CardDto c)
    {
        Validate(c);
        if (await db.Cards.AnyAsync(x => x.UserId == uid && x.Ref == c.Ref)) return false;
        db.Cards.Add(ToEntity(uid, c));
        try { await db.SaveChangesAsync(); return true; }
        catch (DbUpdateException) { return false; } // tab khác vừa tạo trước
    }

    public async Task SaveCard(Guid uid, CardDto c)
    {
        Validate(c);
        var e = await db.Cards.FindAsync(uid, c.Ref);
        if (e is null) db.Cards.Add(ToEntity(uid, c));
        else { e.Ease = c.Ease; e.Interval = c.Interval; e.Repetitions = c.Repetitions; e.Due = c.Due; e.Lapses = c.Lapses; }
        await db.SaveChangesAsync();
    }

    public async Task<List<CardDto>> DueCards(Guid uid, string today)
    {
        if (!Check.Day(today)) throw new ApiException("invalid", "Ngày không hợp lệ.");
        return await db.Cards.Where(c => c.UserId == uid && string.Compare(c.Due, today) <= 0).Select(c => ToDto(c)).ToListAsync();
    }

    public Task<List<CardDto>> AllCards(Guid uid) => db.Cards.Where(c => c.UserId == uid).Select(c => ToDto(c)).ToListAsync();

    // --- Nhật ký ôn ---
    public async Task AddReview(Guid uid, ReviewDto r)
    {
        if (!Check.Ref(r.Ref) || !Check.Day(r.Day) || r.Grade is < 0 or > 3) throw new ApiException("invalid", "Lượt ôn không hợp lệ.");
        db.ReviewLogs.Add(new ReviewLog { UserId = uid, Ref = r.Ref, Grade = r.Grade, Day = r.Day, At = r.At });
        await db.SaveChangesAsync();
    }

    public async Task<List<ReviewDto>> Reviews(Guid uid, string from, string to)
    {
        if (!Check.Day(from) || !Check.Day(to)) throw new ApiException("invalid", "Ngày không hợp lệ.");
        return await db.ReviewLogs.Where(l => l.UserId == uid && string.Compare(l.Day, from) >= 0 && string.Compare(l.Day, to) <= 0)
            .OrderBy(l => l.Id).Select(l => new ReviewDto(l.Id, l.Ref, l.Grade, l.Day, l.At)).ToListAsync();
    }

    // --- Phần người dùng sửa ---
    private static OverrideDto ToDto(ContentOverride o) => new(o.Key, o.MeaningVi, o.HanViet, o.Note, o.Reviewed, o.UpdatedAt);

    public async Task<OverrideDto?> GetOverride(Guid uid, string key) => (await db.Overrides.FindAsync(uid, key)) is { } o ? ToDto(o) : null;
    public Task<List<OverrideDto>> AllOverrides(Guid uid) => db.Overrides.Where(o => o.UserId == uid).Select(o => ToDto(o)).ToListAsync();

    public async Task SaveOverride(Guid uid, OverrideDto o)
    {
        if (!Check.Ref(o.Key) || (o.Note?.Length ?? 0) > 2000 || (o.MeaningVi?.Length ?? 0) > 500 || (o.HanViet?.Length ?? 0) > 200)
            throw new ApiException("invalid", "Nội dung chỉnh sửa không hợp lệ.");
        var e = await db.Overrides.FindAsync(uid, o.Key);
        if (e is null) db.Overrides.Add(new ContentOverride { UserId = uid, Key = o.Key, MeaningVi = o.MeaningVi, HanViet = o.HanViet, Note = o.Note, Reviewed = o.Reviewed, UpdatedAt = o.UpdatedAt });
        else { e.MeaningVi = o.MeaningVi; e.HanViet = o.HanViet; e.Note = o.Note; e.Reviewed = o.Reviewed; e.UpdatedAt = o.UpdatedAt; }
        await db.SaveChangesAsync();
    }

    // --- Hội thoại và thi ---
    public async Task RecordDialogue(Guid uid, string id, int percent)
    {
        if (!Check.Ref(id) || percent is < 0 or > 100) throw new ApiException("invalid", "Kết quả hội thoại không hợp lệ.");
        var now = clock.GetUtcNow().ToUnixTimeMilliseconds();
        var p = await db.Dialogues.FindAsync(uid, id);
        if (p is null) db.Dialogues.Add(new DialogueProgress { UserId = uid, DialogueId = id, Best = percent, Attempts = 1, Last = now });
        else { p.Best = Math.Max(p.Best, percent); p.Attempts++; p.Last = now; }
        await db.SaveChangesAsync();
    }

    public Task<List<DialogueDto>> Dialogues(Guid uid) =>
        db.Dialogues.Where(d => d.UserId == uid).Select(d => new DialogueDto(d.DialogueId, d.Best, d.Attempts, d.Last)).ToListAsync();

    private static void Validate(ExamDto e)
    {
        if (e.Kind is not ("level" or "placement" or "mock") || e.Level is < 1 or > 6 || (e.Detail?.Length ?? 0) > 2000 || e.Total < 1 || e.Correct < 0 || e.Correct > e.Total || e.Percent is < 0 or > 100)
            throw new ApiException("invalid", "Kết quả thi không hợp lệ.");
    }

    public async Task AddExam(Guid uid, ExamDto e)
    {
        Validate(e);
        db.Exams.Add(new ExamResult { UserId = uid, Kind = e.Kind, Level = e.Level, Correct = e.Correct, Total = e.Total, Percent = e.Percent, Passed = e.Passed, At = e.At, Detail = e.Detail });
        await db.SaveChangesAsync();
    }

    public Task<List<ExamDto>> Exams(Guid uid) =>
        db.Exams.Where(x => x.UserId == uid).OrderBy(x => x.At).Select(x => new ExamDto(x.Id, x.Kind, x.Level, x.Correct, x.Total, x.Percent, x.Passed, x.At, x.Detail)).ToListAsync();

    // --- Video YouTube tự lưu ---
    public const int MaxVideosPerUser = 2000;

    public const int MaxMarks = 50;

    private static VideoDto ToDto(SavedVideo v) => new(v.Id, v.VideoId, v.Title, v.Note, v.Level, v.Start, v.CreatedAt, v.LastWatchedAt, ParseMarks(v.MarksJson), v.Position, v.Duration);

    private static List<MarkDto> ParseMarks(string json)
    {
        try { return JsonSerializer.Deserialize<List<MarkDto>>(json, MarkJson) ?? []; }
        catch (JsonException) { return []; }
    }

    private static readonly JsonSerializerOptions MarkJson = new(JsonSerializerDefaults.Web);
    private static string MarksToJson(VideoDto v) => JsonSerializer.Serialize(v.Marks ?? [], MarkJson);

    private static void Validate(VideoDto v)
    {
        if (!Check.Ref(v.Id) || !Check.VideoId(v.VideoId) || (v.Title?.Length ?? 0) is < 1 or > 200 || (v.Note?.Length ?? 0) > 2000
            || v.Level is < 0 or > 6 || v.Start is < 0 or > 172_800
            || v.Position is < 0 or > 172_800 || v.Duration is < 0 or > 172_800 || (v.Marks?.Count ?? 0) > MaxMarks || (v.Marks?.Any(m => m.T is < 0 or > 172_800 || (m.Note?.Length ?? 0) > 200) ?? false))
            throw new ApiException("invalid", "Video không hợp lệ.");
    }

    public Task<List<VideoDto>> Videos(Guid uid) =>
        db.Videos.Where(v => v.UserId == uid).OrderByDescending(v => v.CreatedAt).Select(v => ToDto(v)).ToListAsync();

    public async Task SaveVideo(Guid uid, VideoDto v)
    {
        Validate(v);
        var e = await db.Videos.FindAsync(uid, v.Id);
        if (e is null)
        {
            if (await db.Videos.CountAsync(x => x.UserId == uid) >= MaxVideosPerUser) throw new ApiException("too-large", "Danh sách video đã đầy.", 413);
            db.Videos.Add(new SavedVideo { UserId = uid, Id = v.Id, VideoId = v.VideoId, Title = v.Title, Note = v.Note ?? "", Level = v.Level, Start = v.Start, CreatedAt = v.CreatedAt, LastWatchedAt = v.LastWatchedAt, MarksJson = MarksToJson(v), Position = v.Position, Duration = v.Duration });
        }
        else { e.Position = v.Position; e.Duration = v.Duration; e.MarksJson = MarksToJson(v); e.VideoId = v.VideoId; e.Title = v.Title; e.Note = v.Note ?? ""; e.Level = v.Level; e.Start = v.Start; e.LastWatchedAt = v.LastWatchedAt; }
        await db.SaveChangesAsync();
    }

    public async Task DeleteVideo(Guid uid, string id) => await db.Videos.Where(v => v.UserId == uid && v.Id == id).ExecuteDeleteAsync();

    // --- Đề thi thử đã nạp ---
    public const int MaxPapersPerUser = 30;
    public const int MaxPaperChars = 300_000;

    private static void Validate(PaperDto p)
    {
        if (!Check.Ref(p.Id) || (p.Title?.Trim().Length ?? 0) is < 1 or > 120 || p.Level is < 1 or > 6 || string.IsNullOrEmpty(p.Json) || p.Json.Length > MaxPaperChars)
            throw new ApiException("invalid", "Đề thi không hợp lệ hoặc quá lớn.");
        try { using var _ = JsonDocument.Parse(p.Json); }
        catch (JsonException) { throw new ApiException("invalid", "Nội dung đề không phải JSON hợp lệ."); }
    }

    public Task<List<PaperMetaDto>> Papers(Guid uid) =>
        db.Papers.Where(p => p.UserId == uid).OrderByDescending(p => p.SavedAt).Select(p => new PaperMetaDto(p.Id, p.Title, p.Level, p.SavedAt)).ToListAsync();

    public async Task<PaperDto?> GetPaper(Guid uid, string id) =>
        (await db.Papers.FindAsync(uid, id)) is { } p ? new PaperDto(p.Id, p.Title, p.Level, p.SavedAt, p.Json) : null;

    public async Task SavePaper(Guid uid, PaperDto p)
    {
        Validate(p);
        var e = await db.Papers.FindAsync(uid, p.Id);
        if (e is null)
        {
            if (await db.Papers.CountAsync(x => x.UserId == uid) >= MaxPapersPerUser) throw new ApiException("too-large", "Đã lưu tối đa số đề cho phép.", 413);
            db.Papers.Add(new SavedPaper { UserId = uid, Id = p.Id, Title = p.Title, Level = p.Level, SavedAt = p.SavedAt, Json = p.Json });
        }
        else { e.Title = p.Title; e.Level = p.Level; e.SavedAt = p.SavedAt; e.Json = p.Json; }
        await db.SaveChangesAsync();
    }

    public async Task DeletePaper(Guid uid, string id) => await db.Papers.Where(p => p.UserId == uid && p.Id == id).ExecuteDeleteAsync();

    // --- Xuất, nhập ---
    public async Task<ProgressExport> Export(Guid uid) => new(
        1, clock.GetUtcNow().ToString("O"), await GetSettings(uid), await AllCards(uid),
        await db.ReviewLogs.Where(l => l.UserId == uid).OrderBy(l => l.Id).Select(l => new ReviewDto(l.Id, l.Ref, l.Grade, l.Day, l.At)).ToListAsync(),
        await AllOverrides(uid), await Exams(uid), await Dialogues(uid), await Videos(uid),
        await db.Papers.Where(p => p.UserId == uid).Select(p => new PaperDto(p.Id, p.Title, p.Level, p.SavedAt, p.Json)).ToListAsync());

    /// <summary>Thay toàn bộ tiến độ của người dùng bằng dữ liệu nhập, trong một giao dịch: lỗi thì giữ nguyên dữ liệu cũ.</summary>
    public async Task Import(Guid uid, ProgressExport d)
    {
        if (d.Version != 1) throw new ApiException("invalid", "File tiến độ không đúng phiên bản.");
        if ((d.Cards?.Count ?? 0) + (d.Log?.Count ?? 0) > MaxImportRows) throw new ApiException("too-large", "File tiến độ quá lớn.", 413);
        foreach (var c in d.Cards ?? []) Validate(c);
        foreach (var e in d.Exams ?? []) Validate(e);
        foreach (var v in d.Videos ?? []) Validate(v);
        foreach (var pp in d.Papers ?? []) Validate(pp);
        if ((d.Papers?.Count ?? 0) > MaxPapersPerUser) throw new ApiException("too-large", "Có quá nhiều đề trong file.", 413);
        if ((d.Videos?.Count ?? 0) > MaxVideosPerUser) throw new ApiException("too-large", "Danh sách video quá lớn.", 413);
        foreach (var l in d.Log ?? [])
            if (!Check.Ref(l.Ref) || !Check.Day(l.Day) || l.Grade is < 0 or > 3) throw new ApiException("invalid", "Nhật ký ôn không hợp lệ.");

        await using var tx = await db.Database.BeginTransactionAsync();
        await db.Cards.Where(x => x.UserId == uid).ExecuteDeleteAsync();
        await db.ReviewLogs.Where(x => x.UserId == uid).ExecuteDeleteAsync();
        await db.Overrides.Where(x => x.UserId == uid).ExecuteDeleteAsync();
        await db.Exams.Where(x => x.UserId == uid).ExecuteDeleteAsync();
        await db.Dialogues.Where(x => x.UserId == uid).ExecuteDeleteAsync();
        await db.UserSettings.Where(x => x.UserId == uid).ExecuteDeleteAsync();
        await db.Videos.Where(x => x.UserId == uid).ExecuteDeleteAsync();
        await db.Papers.Where(x => x.UserId == uid).ExecuteDeleteAsync();

        if (d.Settings is { ValueKind: JsonValueKind.Object } s) db.UserSettings.Add(new UserSettings { UserId = uid, Json = s.GetRawText() });
        db.Cards.AddRange((d.Cards ?? []).DistinctBy(c => c.Ref).Select(c => ToEntity(uid, c)));
        db.ReviewLogs.AddRange((d.Log ?? []).Select(l => new ReviewLog { UserId = uid, Ref = l.Ref, Grade = l.Grade, Day = l.Day, At = l.At }));
        db.Overrides.AddRange((d.Overrides ?? []).Where(o => Check.Ref(o.Key)).DistinctBy(o => o.Key)
            .Select(o => new ContentOverride { UserId = uid, Key = o.Key, MeaningVi = o.MeaningVi, HanViet = o.HanViet, Note = o.Note, Reviewed = o.Reviewed, UpdatedAt = o.UpdatedAt }));
        db.Exams.AddRange((d.Exams ?? []).Select(e => new ExamResult { UserId = uid, Kind = e.Kind, Level = e.Level, Correct = e.Correct, Total = e.Total, Percent = e.Percent, Passed = e.Passed, At = e.At, Detail = e.Detail }));
        db.Dialogues.AddRange((d.Dialogues ?? []).Where(x => Check.Ref(x.Id)).DistinctBy(x => x.Id)
            .Select(x => new DialogueProgress { UserId = uid, DialogueId = x.Id, Best = Math.Clamp(x.Best, 0, 100), Attempts = Math.Max(0, x.Attempts), Last = x.Last }));
        db.Papers.AddRange((d.Papers ?? []).DistinctBy(x => x.Id).Select(x => new SavedPaper { UserId = uid, Id = x.Id, Title = x.Title, Level = x.Level, SavedAt = x.SavedAt, Json = x.Json }));
        db.Videos.AddRange((d.Videos ?? []).DistinctBy(v => v.Id).Select(v => new SavedVideo { UserId = uid, Id = v.Id, VideoId = v.VideoId, Title = v.Title, Note = v.Note ?? "", Level = v.Level, Start = v.Start, CreatedAt = v.CreatedAt, LastWatchedAt = v.LastWatchedAt, MarksJson = MarksToJson(v), Position = v.Position, Duration = v.Duration }));
        await db.SaveChangesAsync();
        await tx.CommitAsync();
    }

    // --- Tóm tắt cho quản trị viên ---
    public async Task<Summary> Summarize(Guid uid, string today)
    {
        var cards = await db.Cards.Where(c => c.UserId == uid).Select(c => new { c.Interval, c.Due }).ToListAsync();
        var days = await db.ReviewLogs.Where(l => l.UserId == uid).Select(l => l.Day).Distinct().ToListAsync();
        var set = days.ToHashSet();
        var reviewedToday = await db.ReviewLogs.CountAsync(l => l.UserId == uid && l.Day == today);
        var d = DateOnly.ParseExact(today, "yyyy-MM-dd");
        if (!set.Contains(today)) d = d.AddDays(-1);
        var streak = 0;
        while (set.Contains(d.ToString("yyyy-MM-dd"))) { streak++; d = d.AddDays(-1); }
        return new Summary(cards.Count, cards.Count(c => c.Interval >= MatureInterval), cards.Count(c => string.CompareOrdinal(c.Due, today) <= 0), reviewedToday, streak);
    }
}
