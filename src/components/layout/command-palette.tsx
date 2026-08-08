"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useUiStore } from "@/stores/ui-store";
import { NAV_ITEMS } from "@/lib/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import { apiFetch, unwrapList } from "@/lib/api-client";

type SearchHit = {
  module: string;
  id: string;
  title: string;
  subtitle?: string | null;
  href: string;
};

export function CommandPalette() {
  const router = useRouter();
  const { commandPaletteOpen, setCommandPaletteOpen } = useUiStore();
  const { can } = usePermissions();
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  React.useEffect(() => {
    if (!commandPaletteOpen) {
      setQuery("");
      setDebounced("");
    }
  }, [commandPaletteOpen]);

  const searchQuery = useQuery({
    queryKey: ["search", debounced],
    enabled: commandPaletteOpen && debounced.length >= 2,
    queryFn: async () => {
      const params = new URLSearchParams({ q: debounced, limit: "8" });
      const res = await apiFetch<unknown>(`/api/search?${params}`);
      return unwrapList<SearchHit>(res.data);
    },
  });

  const items = NAV_ITEMS.filter(
    (item) => !item.permission || can(item.permission),
  );

  const hits = searchQuery.data ?? [];

  return (
    <CommandDialog
      open={commandPaletteOpen}
      onOpenChange={setCommandPaletteOpen}
      title="Command palette"
      description="Search records or jump to a module"
    >
      <Command shouldFilter={false} className="rounded-xl border-0">
      <CommandInput
        placeholder="Search leads, customers, invoices…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {debounced.length >= 2 && searchQuery.isFetching
            ? "Searching…"
            : "No results found."}
        </CommandEmpty>

        {hits.length ? (
          <CommandGroup heading="Records">
            {hits.map((hit) => (
              <CommandItem
                key={`${hit.module}-${hit.id}`}
                value={`${hit.title} ${hit.subtitle ?? ""} ${hit.module}`}
                onSelect={() => {
                  setCommandPaletteOpen(false);
                  const href =
                    hit.module === "leads"
                      ? `/leads/${hit.id}`
                      : hit.href;
                  router.push(href);
                }}
              >
                <span className="flex flex-col gap-0.5">
                  <span>{hit.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {hit.module}
                    {hit.subtitle ? ` · ${hit.subtitle}` : ""}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {hits.length ? <CommandSeparator /> : null}

        <CommandGroup heading="Navigation">
          {items
            .filter((item) => {
              if (!debounced) return true;
              const q = debounced.toLowerCase();
              return (
                item.title.toLowerCase().includes(q) ||
                item.href.toLowerCase().includes(q)
              );
            })
            .map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.href}
                  value={`${item.title} ${item.href}`}
                  onSelect={() => {
                    setCommandPaletteOpen(false);
                    router.push(item.href);
                  }}
                >
                  <Icon className="size-4 text-primary" />
                  {item.title}
                </CommandItem>
              );
            })}
        </CommandGroup>
      </CommandList>
      </Command>
    </CommandDialog>
  );
}
