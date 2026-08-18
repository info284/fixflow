// app/components/home/HomeNav.tsx

import Link from "next/link";

export default function HomeNav() {
  return (
    <nav className="homeNav">
      <div className="homeNavInner">

        <Link href="/" className="homeNavLogo">
          Fix<span>Flow</span>
        </Link>

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