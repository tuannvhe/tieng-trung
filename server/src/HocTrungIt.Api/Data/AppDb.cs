using Microsoft.EntityFrameworkCore;

namespace HocTrungIt.Api.Data;

public class AppDb(DbContextOptions<AppDb> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<AppSetting> AppSettings => Set<AppSetting>();
    public DbSet<UserSettings> UserSettings => Set<UserSettings>();
    public DbSet<Card> Cards => Set<Card>();
    public DbSet<ReviewLog> ReviewLogs => Set<ReviewLog>();
    public DbSet<ContentOverride> Overrides => Set<ContentOverride>();
    public DbSet<DialogueProgress> Dialogues => Set<DialogueProgress>();
    public DbSet<ExamResult> Exams => Set<ExamResult>();
    public DbSet<SavedVideo> Videos => Set<SavedVideo>();
    public DbSet<SavedPaper> Papers => Set<SavedPaper>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>(e =>
        {
            e.HasIndex(x => x.Username).IsUnique();
            e.Property(x => x.Username).HasMaxLength(32);
            e.Property(x => x.DisplayName).HasMaxLength(40);
            e.Property(x => x.Role).HasMaxLength(16);
        });
        b.Entity<AppSetting>(e => { e.HasKey(x => x.Key); e.Property(x => x.Key).HasMaxLength(64); });
        b.Entity<UserSettings>(e => e.HasKey(x => x.UserId));

        // Mọi bảng tiến độ gắn với người dùng và bị xóa theo khi xóa người dùng.
        b.Entity<Card>(e =>
        {
            e.HasKey(x => new { x.UserId, x.Ref });
            e.Property(x => x.Ref).HasMaxLength(64);
            e.Property(x => x.Due).HasMaxLength(10);
            e.HasIndex(x => new { x.UserId, x.Due });
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });
        b.Entity<ReviewLog>(e =>
        {
            e.Property(x => x.Ref).HasMaxLength(64);
            e.Property(x => x.Day).HasMaxLength(10);
            e.HasIndex(x => new { x.UserId, x.Day });
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });
        b.Entity<ContentOverride>(e =>
        {
            e.HasKey(x => new { x.UserId, x.Key });
            e.Property(x => x.Key).HasMaxLength(64);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });
        b.Entity<DialogueProgress>(e =>
        {
            e.HasKey(x => new { x.UserId, x.DialogueId });
            e.Property(x => x.DialogueId).HasMaxLength(64);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });
        b.Entity<ExamResult>(e =>
        {
            e.Property(x => x.Kind).HasMaxLength(16);
            e.Property(x => x.Detail).HasMaxLength(2000);
            e.HasIndex(x => new { x.UserId, x.At });
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });
        b.Entity<SavedVideo>(e =>
        {
            e.HasKey(x => new { x.UserId, x.Id });
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.VideoId).HasMaxLength(11);
            e.Property(x => x.Title).HasMaxLength(200);
            e.Property(x => x.Note).HasMaxLength(2000);
            e.HasIndex(x => new { x.UserId, x.CreatedAt });
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });
        b.Entity<SavedPaper>(e =>
        {
            e.HasKey(x => new { x.UserId, x.Id });
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.Title).HasMaxLength(120);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });
        b.Entity<UserSettings>().HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
