using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HocTrungIt.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddVideoMarks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MarksJson",
                table: "Videos",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MarksJson",
                table: "Videos");
        }
    }
}
