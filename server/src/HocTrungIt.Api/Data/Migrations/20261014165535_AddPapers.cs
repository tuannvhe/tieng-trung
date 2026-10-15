using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HocTrungIt.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPapers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Papers",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Id = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Level = table.Column<int>(type: "int", nullable: false),
                    SavedAt = table.Column<long>(type: "bigint", nullable: false),
                    Json = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Papers", x => new { x.UserId, x.Id });
                    table.ForeignKey(
                        name: "FK_Papers_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Papers");
        }
    }
}
