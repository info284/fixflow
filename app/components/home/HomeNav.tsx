// app/components/home/HomeNav.tsx


export default function HomeNav() {
  return (
    <nav className="homeNav">
      <div className="homeNavInner">
        <div className="homeNavLogo">
          Fix<span>Flow</span>
        </div>
<div className="homeNavActions">
  <a className="homeNavLogin" href="/login">
    Log in
  </a>

  <a className="homeNavCta" href="/signup">
    Start free
  </a>

        </div>
      </div>
    </nav>
  );
}
