using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HocTrungIt.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddVideos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Videos",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Id = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    VideoId = table.Column<string>(type: "nvarchar(11)", maxLength: 11, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    Level = table.Column<int>(type: "int", nullable: false),
                    Start = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<long>(type: "bigint", nullable: false),
                    LastWatchedAt = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Videos", x => new { x.UserId, x.Id });
                    table.ForeignKey(
                        name: "FK_Videos_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Videos_UserId_CreatedAt",
                table: "Videos",
                columns: new[] { "UserId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Videos");
        }
    }
}
