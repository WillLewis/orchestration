import { Link, useRouterState } from "@tanstack/react-router";

import { docsNav } from "@/data/docsNav";

export function DocsSidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <aside className="sticky top-[64px] hidden h-[calc(100vh-80px)] w-56 shrink-0 overflow-y-auto pr-2 md:block">
      <nav className="space-y-6">
        {docsNav.map((section) => (
          <div key={section.label}>
            <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
              {section.label}
            </div>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = item.live && item.to === pathname;

                return (
                  <li key={item.label}>
                    {isActive ? (
                      <span className="relative block rounded px-2 py-1 text-[12.5px] font-medium text-zinc-100">
                        <span className="absolute inset-y-1 left-0 w-[2px] rounded bg-emerald-400" />
                        <span className="pl-2">{item.label}</span>
                      </span>
                    ) : item.live ? (
                      <Link
                        to={item.to}
                        className="block w-full rounded px-2 py-1 text-left text-[12.5px] text-zinc-500 hover:text-zinc-300"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="block w-full cursor-default rounded px-2 py-1 text-left text-[12.5px] text-zinc-500 hover:text-zinc-300"
                      >
                        {item.label}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
