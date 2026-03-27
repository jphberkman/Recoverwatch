import { Link, NavLink } from 'react-router-dom';

export function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950">
      <header className="border-b border-slate-800/80 bg-navy-900/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
            <span className="h-2 w-2 rounded-full bg-amber-brand shadow-[0_0_12px_#F59E0B]" aria-hidden />
            RecoverWatch
          </Link>
          <nav className="flex flex-wrap items-center gap-2 sm:gap-4">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`
              }
            >
              My Items
            </NavLink>
            <Link
              to="/add"
              className="rounded-md bg-amber-brand px-4 py-2 text-sm font-semibold text-navy-950 shadow hover:bg-amber-400"
            >
              Add Item
            </Link>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`
              }
            >
              Settings
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
