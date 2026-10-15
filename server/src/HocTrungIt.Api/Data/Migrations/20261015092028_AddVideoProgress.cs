using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HocTrungIt.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddVideoProgress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Duration",
                table: "Videos",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Position",
                table: "Videos",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Duration",
                table: "Videos");

            migrationBuilder.DropColumn(
                name: "Position",
                table: "Videos");
        }
    }
}
