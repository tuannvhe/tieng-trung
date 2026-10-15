using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using HocTrungIt.Api.Data;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace HocTrungIt.Api.Security;

public class JwtOptions
{
    public string Key { get; set; } = "";
    public string Issuer { get; set; } = "hoc-trung-it";
    public int RememberDays { get; set; } = 30;
    public int SessionHours { get; set; } = 12;

    public SymmetricSecurityKey SigningKey => new(Encoding.UTF8.GetBytes(Key));
}

public class TokenService(IOptions<JwtOptions> options, TimeProvider clock)
{
    private readonly JwtOptions _o = options.Value;

    public (string Token, DateTimeOffset Expires) Issue(User u, bool remember)
    {
        var expires = clock.GetUtcNow() + (remember ? TimeSpan.FromDays(_o.RememberDays) : TimeSpan.FromHours(_o.SessionHours));
        var token = new JwtSecurityToken(
            _o.Issuer, _o.Issuer,
            [new Claim(JwtRegisteredClaimNames.Sub, u.Id.ToString()), new Claim("role", u.Role), new Claim("ver", u.TokenVersion.ToString())],
            notBefore: clock.GetUtcNow().UtcDateTime, expires: expires.UtcDateTime,
            signingCredentials: new SigningCredentials(_o.SigningKey, SecurityAlgorithms.HmacSha256));
        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }
}
