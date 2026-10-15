using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HocTrungIt.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddExamDetail : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Detail",
                table: "Exams",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Detail",
                table: "Exams");
        }
    }
}
