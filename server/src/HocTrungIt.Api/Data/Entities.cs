namespace HocTrungIt.Api.Data;

public static class Roles
{
    public const string Admin = "admin";
    public const string Learner = "learner";
    public static bool IsValid(string? r) => r is Admin or Learner;
}

public class User
{
    public Guid Id { get; set; }
    public string Username { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string Role { get; set; } = Roles.Learner;
    public bool Disabled { get; set; }
    public long CreatedAt { get; set; }
    public long? LastLoginAt { get; set; }
    public byte[] Hash { get; set; } = [];
    public byte[] Salt { get; set; } = [];
    public int Iterations { get; set; }
    public int Failed { get; set; }
    public long LockedUntil { get; set; }
    /// <summary>Tăng mỗi khi đổi hoặc đặt lại mật khẩu, vô hiệu hóa, đổi vai trò: token cũ hết hiệu lực.</summary>
    public int TokenVersion { get; set; }
}

public class AppSetting
{
    public string Key { get; set; } = "";
    public string Value { get; set; } = "";
}

public class UserSettings
{
    public Guid UserId { get; set; }
    public string Json { get; set; } = "{}";
}

public class Card
{
    public Guid UserId { get; set; }
    public string Ref { get; set; } = "";
    public double Ease { get; set; }
    public int Interval { get; set; }
    public int Repetitions { get; set; }
    public string Due { get; set; } = "";
    public int Lapses { get; set; }
    public long CreatedAt { get; set; }
}

public class ReviewLog
{
    public long Id { get; set; }
    public Guid UserId { get; set; }
    public string Ref { get; set; } = "";
    public int Grade { get; set; }
    public string Day { get; set; } = "";
    public long At { get; set; }
}

public class ContentOverride
{
    public Guid UserId { get; set; }
    public string Key { get; set; } = "";
    public string? MeaningVi { get; set; }
    public string? HanViet { get; set; }
    public string? Note { get; set; }
    public bool? Reviewed { get; set; }
    public long UpdatedAt { get; set; }
}

public class DialogueProgress
{
    public Guid UserId { get; set; }
    public string DialogueId { get; set; } = "";
    public int Best { get; set; }
    public int Attempts { get; set; }
    public long Last { get; set; }
}

public class ExamResult
{
    public long Id { get; set; }
    public Guid UserId { get; set; }
    public string Kind { get; set; } = "level";
    public int Level { get; set; }
    public int Correct { get; set; }
    public int Total { get; set; }
    public int Percent { get; set; }
    public bool Passed { get; set; }
    public long At { get; set; }
    /// <summary>Chi tiết điểm từng phần của bài thi thử (JSON), rỗng với các bài thi khác.</summary>
    public string? Detail { get; set; }
}

public class SavedPaper
{
    public Guid UserId { get; set; }
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public int Level { get; set; }
    public long SavedAt { get; set; }
    /// <summary>Nội dung file đề đã được giao diện kiểm tra (JSON).</summary>
    public string Json { get; set; } = "";
}

public class SavedVideo
{
    public Guid UserId { get; set; }
    public string Id { get; set; } = "";
    public string VideoId { get; set; } = "";
    public string Title { get; set; } = "";
    public string Note { get; set; } = "";
    public int Level { get; set; }
    public int Start { get; set; }
    public long CreatedAt { get; set; }
    public long? LastWatchedAt { get; set; }
    /// <summary>Danh sách mốc [{t, note}] dạng JSON.</summary>
    public string MarksJson { get; set; } = "[]";
    /// <summary>Giây đã xem tới và tổng độ dài video.</summary>
    public int Position { get; set; }
    public int Duration { get; set; }
}
