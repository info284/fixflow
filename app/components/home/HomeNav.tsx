// app/components/home/HomeNav.tsx
import Link from "next/link";

export default function HomeNav() {
  return (
    <nav className="homeNav">
      <div className="homeNavInner">
        <div className="homeNavLogo">
          Fix<span>Flow</span>
        </div>
        <div className="homeNavActions">
          <Link className="homeNavLogin" href="/login">Log in</Link>
          <Link className="homeNavCta" href="/signup">Start free</Link>
        </div>
      </div>
    </nav>
  );
}
