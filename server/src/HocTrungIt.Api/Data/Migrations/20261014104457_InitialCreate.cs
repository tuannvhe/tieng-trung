using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HocTrungIt.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AppSettings",
                columns: table => new
                {
                    Key = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Value = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AppSettings", x => x.Key);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Username = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Role = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    Disabled = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<long>(type: "bigint", nullable: false),
                    LastLoginAt = table.Column<long>(type: "bigint", nullable: true),
                    Hash = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    Salt = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    Iterations = table.Column<int>(type: "int", nullable: false),
                    Failed = table.Column<int>(type: "int", nullable: false),
                    LockedUntil = table.Column<long>(type: "bigint", nullable: false),
                    TokenVersion = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Cards",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Ref = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Ease = table.Column<double>(type: "float", nullable: false),
                    Interval = table.Column<int>(type: "int", nullable: false),
                    Repetitions = table.Column<int>(type: "int", nullable: false),
                    Due = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Lapses = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Cards", x => new { x.UserId, x.Ref });
                    table.ForeignKey(
                        name: "FK_Cards_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Dialogues",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DialogueId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Best = table.Column<int>(type: "int", nullable: false),
                    Attempts = table.Column<int>(type: "int", nullable: false),
                    Last = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Dialogues", x => new { x.UserId, x.DialogueId });
                    table.ForeignKey(
                        name: "FK_Dialogues_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Exams",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    Level = table.Column<int>(type: "int", nullable: false),
                    Correct = table.Column<int>(type: "int", nullable: false),
                    Total = table.Column<int>(type: "int", nullable: false),
                    Percent = table.Column<int>(type: "int", nullable: false),
                    Passed = table.Column<bool>(type: "bit", nullable: false),
                    At = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Exams", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Exams_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Overrides",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    MeaningVi = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    HanViet = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Note = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Reviewed = table.Column<bool>(type: "bit", nullable: true),
                    UpdatedAt = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Overrides", x => new { x.UserId, x.Key });
                    table.ForeignKey(
                        name: "FK_Overrides_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ReviewLogs",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Ref = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Grade = table.Column<int>(type: "int", nullable: false),
                    Day = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    At = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReviewLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReviewLogs_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserSettings",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Json = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserSettings", x => x.UserId);
                    table.ForeignKey(
                        name: "FK_UserSettings_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Cards_UserId_Due",
                table: "Cards",
                columns: new[] { "UserId", "Due" });

            migrationBuilder.CreateIndex(
                name: "IX_Exams_UserId_At",
                table: "Exams",
                columns: new[] { "UserId", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_ReviewLogs_UserId_Day",
                table: "ReviewLogs",
                columns: new[] { "UserId", "Day" });

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                column: "Username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AppSettings");

            migrationBuilder.DropTable(
                name: "Cards");

            migrationBuilder.DropTable(
                name: "Dialogues");

            migrationBuilder.DropTable(
                name: "Exams");

            migrationBuilder.DropTable(
                name: "Overrides");

            migrationBuilder.DropTable(
                name: "ReviewLogs");

            migrationBuilder.DropTable(
                name: "UserSettings");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
