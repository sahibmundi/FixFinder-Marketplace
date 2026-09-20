import { type ReactNode, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, UserButton, useAuth } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Link, Redirect, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import { useForm } from 'react-hook-form';
import {
  ArrowRight, BadgeCheck, CarFront, Check, ChevronDown, ChevronRight, Clock3, Compass, Gauge,
  ListFilter, Loader2, MapPin, Menu, MessageSquareText, Navigation, Phone, Search, Send,
  ShieldCheck, SlidersHorizontal, Sparkles, Star, ToolCase, Wrench, X, Zap,
} from 'lucide-react';
import {
  getGetDashboardStatsQueryKey, getGetMyProviderQueryKey, getGetProviderQueryKey, getHealthCheckQueryKey,
  getListAdminProvidersQueryKey, getListCategoriesQueryKey, getListProvidersQueryKey,
  getUpdateProviderMutationKey, useCreateAdminCategory, useCreateEnquiry, useCreateProvider, useGetDashboardStats, useGetMyProvider,
  useGetProvider, useHealthCheck, useListAdminProviders, useListCategories, useListProviders,
  useUpdateAdminCategory, useUpdateProvider, useUpdateProviderStatus,
} from '@workspace/api-client-react';
import type { AdminProvider, Category, ProviderInput, ProviderProfile, ProviderUpdate, WorkingHour } from '@workspace/api-client-react';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const categoryIcons: Record<string, typeof Wrench> = {
  wrench: Wrench, car: CarFront, battery: Zap, tire: Gauge, paint: Sparkles, tow: Navigation,
};

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" data-testid="link-logo">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Wrench size={19} strokeWidth={2.6} />
      </span>
      <span className={`text-[21px] font-extrabold tracking-[-.07em] ${dark ? 'text-sidebar-foreground' : 'text-foreground'}`}>fixfinder</span>
    </Link>
  );
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isSignedIn } = useAuth();
  return (
    <header className="relative z-20 border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-[70px] max-w-7xl items-center justify-between px-5 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-7 md:flex">
          <Link href="/search" className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground" data-testid="link-find-service">Find a service</Link>
          <Link href="/join" className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground" data-testid="link-join-network">Join the network</Link>
          <Link href="/admin" className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground" data-testid="link-admin">Admin</Link>
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          {!isSignedIn ? (
            <>
            <Link href="/sign-in" className="rounded-lg px-3 py-2 text-sm font-bold text-foreground hover:bg-muted" data-testid="link-sign-in">Sign in</Link>
            <Link href="/sign-up" className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-bold text-background transition-transform hover:-translate-y-0.5" data-testid="link-sign-up">Create account</Link>
            </>
          ) : (
            <>
            <Link href="/join" className="rounded-lg px-3 py-2 text-sm font-bold text-foreground hover:bg-muted" data-testid="link-dashboard">My profile</Link>
            <UserButton appearance={{ elements: { avatarBox: 'h-9 w-9' } }} />
            </>
          )}
        </div>
        <button type="button" className="rounded-lg p-2 md:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label="Open menu" data-testid="button-open-menu">
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>
      {menuOpen && (
        <div className="border-t border-border bg-card px-5 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            <Link href="/search" className="py-2 text-sm font-bold" onClick={() => setMenuOpen(false)} data-testid="mobile-link-search">Find a service</Link>
            <Link href="/join" className="py-2 text-sm font-bold" onClick={() => setMenuOpen(false)} data-testid="mobile-link-join">Join the network</Link>
            <Link href="/sign-in" className="py-2 text-sm font-bold" onClick={() => setMenuOpen(false)} data-testid="mobile-link-sign-in">Sign in</Link>
          </div>
        </div>
      )}
    </header>
  );
}

function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`min-h-[100dvh] bg-background ${className}`}><Header />{children}</div>;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-3 flex items-center gap-2 font-mono-ui text-[11px] font-medium uppercase tracking-[.16em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary" />{children}</p>;
}

function Stars({ value, count, light = false }: { value: number; count?: number; light?: boolean }) {
  return <span className={`inline-flex items-center gap-1 ${light ? 'text-accent' : 'text-primary'}`} data-testid="rating-stars">
    <Star size={14} fill="currentColor" />
    <strong className="text-sm text-foreground">{value.toFixed(1)}</strong>
    {count !== undefined && <span className="text-xs text-muted-foreground">({count})</span>}
  </span>;
}

function CategoryIcon({ icon, size = 20 }: { icon: string; size?: number }) {
  const Icon = categoryIcons[icon.toLowerCase()] || Wrench;
  return <Icon size={size} strokeWidth={1.8} />;
}

function LoadingCards({ count = 3 }: { count?: number }) {
  return <div className="grid gap-4 md:grid-cols-3">{Array.from({ length: count }, (_, i) => (
    <div className="rounded-2xl border border-border bg-card p-5" key={i}><div className="skeleton mb-5 h-40 rounded-xl" /><div className="skeleton mb-3 h-4 w-2/3 rounded" /><div className="skeleton h-3 w-1/2 rounded" /></div>
  ))}</div>;
}

function ErrorState({ onRetry, compact = false }: { onRetry: () => void; compact?: boolean }) {
  return <div className={`rounded-2xl border border-primary/20 bg-primary/5 text-center ${compact ? 'p-7' : 'px-6 py-14'}`}>
    <ToolCase className="mx-auto mb-3 text-primary" size={compact ? 22 : 30} />
    <h3 className="font-display text-xl font-semibold">The garage door is stuck</h3>
    <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">We could not load this right now. Give it another turn.</p>
    <Button onClick={onRetry} className="mt-5" data-testid="button-retry">Try again</Button>
  </div>;
}

function EmptyState({ title = 'No matches yet', body = 'Try widening your search or choosing another neighborhood.' }: { title?: string; body?: string }) {
  return <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
    <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-secondary-foreground"><Compass size={25} /></div>
    <h3 className="font-display text-xl font-semibold">{title}</h3><p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{body}</p>
  </div>;
}

function ProviderCard({ provider }: { provider: ProviderProfile }) {
  return <Link href={`/provider/${provider.id}`} className="group lift block rounded-2xl border border-border bg-card p-4" data-testid={`card-provider-${provider.id}`}>
    <div className="relative mb-4 overflow-hidden rounded-xl bg-secondary">
      {provider.profilePhoto ? <img src={provider.profilePhoto} alt={provider.name} className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" /> : (
        <div className="flex h-44 items-end justify-between p-5"><span className="font-display text-4xl text-secondary-foreground">{provider.name.slice(0, 1)}</span><Wrench size={40} className="text-secondary-foreground/30" /></div>
      )}
      {provider.verified && <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-card/95 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.08em] text-secondary-foreground"><BadgeCheck size={13} /> Verified</span>}
      {provider.distanceKm !== null && <span className="absolute bottom-3 right-3 rounded-full bg-foreground/85 px-2.5 py-1 font-mono-ui text-[10px] text-background">{provider.distanceKm.toFixed(1)} km</span>}
    </div>
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-[11px] font-bold uppercase tracking-[.12em] text-primary">{provider.category.name}</p><h3 className="mt-1 text-base font-extrabold">{provider.shopName}</h3><p className="mt-0.5 text-sm text-muted-foreground">{provider.name}</p></div>
      <ChevronRight className="mt-1 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" size={19} />
    </div>
    <div className="mt-4 flex items-center justify-between border-t border-border pt-3"><Stars value={provider.rating} count={provider.reviewCount} /><span className={`text-xs font-bold ${provider.availability === 'available' ? 'text-secondary-foreground' : 'text-muted-foreground'}`}>{provider.availability === 'available' ? 'Available today' : provider.availability}</span></div>
  </Link>;
}

function SearchBar({ large = false, initialQuery = '', initialCity = '' }: { large?: boolean; initialQuery?: string; initialCity?: string }) {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState(initialQuery);
  const [city, setCity] = useState(initialCity);
  const submit = (event: React.FormEvent) => { event.preventDefault(); setLocation(`/search?q=${encodeURIComponent(query)}&city=${encodeURIComponent(city)}`); };
  return <form onSubmit={submit} className={`flex flex-col gap-2 rounded-2xl border border-border bg-card p-2 shadow-[0_10px_35px_rgba(31,38,43,.08)] sm:flex-row ${large ? 'sm:p-2.5' : ''}`}>
    <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 focus-within:bg-muted"><Search className="shrink-0 text-primary" size={19} /><span className="sr-only">What do you need?</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Brake repair, oil change, tires…" className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground" data-testid="input-search-service" /></label>
    <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 focus-within:bg-muted"><MapPin className="shrink-0 text-primary" size={19} /><span className="sr-only">City</span><input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City or neighborhood" className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground" data-testid="input-search-city" /></label>
    <Button type="submit" className="h-12 rounded-xl px-6" data-testid="button-search"><Search size={17} />Search</Button>
  </form>;
}

function Home() {
  const categoriesQuery = useListCategories({ query: { queryKey: getListCategoriesQueryKey(), staleTime: 600000 } });
  const providersQuery = useListProviders({ verified: true, limit: 3 }, { query: { queryKey: getListProvidersQueryKey({ verified: true, limit: 3 }), staleTime: 300000 } });
  const healthQuery = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), staleTime: 60000 } });
  const categories = categoriesQuery.data || [];
  const providers = providersQuery.data?.items || [];
  return <Page>
    <main>
      <section className="paper-grid relative overflow-hidden border-b border-border">
        <div className="absolute -right-32 top-10 h-80 w-80 rounded-full bg-accent/30 blur-3xl" />
        <div className="mx-auto grid max-w-7xl gap-10 px-5 pb-20 pt-16 lg:grid-cols-[1.15fr_.85fr] lg:px-8 lg:pb-28 lg:pt-24">
          <div className="relative animate-rise">
            <SectionLabel>Local help, without the runaround</SectionLabel>
            <h1 className="max-w-2xl font-display text-[clamp(3.3rem,7vw,6.7rem)] leading-[.93] tracking-[-.065em]">Your car.<br /><em className="text-primary">In good hands.</em></h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">Find trusted mechanics and vehicle specialists nearby. Real profiles, verified shops, clear services — no mystery numbers.</p>
            <div className="mt-8 max-w-2xl"><SearchBar large /></div>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-muted-foreground"><span className="flex items-center gap-1.5"><ShieldCheck size={15} className="text-secondary-foreground" />Verified local providers</span><span className="flex items-center gap-1.5"><Phone size={14} className="text-secondary-foreground" />Talk to a real person</span></div>
          </div>
          <div className="relative hidden min-h-[370px] items-end justify-end lg:flex">
            <div className="absolute right-3 top-10 h-72 w-72 rounded-[5rem] rounded-br-[9rem] border-[18px] border-foreground bg-primary/90 shadow-2xl rotate-6" />
            <div className="relative z-10 w-72 rounded-3xl border border-border bg-card p-5 shadow-[0_22px_70px_rgba(31,38,43,.18)]">
              <div className="mb-12 flex items-center justify-between"><span className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-muted-foreground">Nearby now</span><span className="flex items-center gap-1.5 text-[11px] font-bold text-secondary-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-secondary-foreground" />Live</span></div>
              <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary text-secondary-foreground"><Wrench size={20} /></div><div><p className="font-bold">Miller & Son Auto</p><p className="text-xs text-muted-foreground">Brake specialist · 0.8 km</p></div></div>
              <div className="mt-5 flex items-center justify-between border-t border-border pt-4"><Stars value={4.9} count={84} /><span className="font-mono-ui text-[10px] text-muted-foreground">OPEN UNTIL 6:30</span></div>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="flex items-end justify-between gap-4"><div><SectionLabel>Browse by need</SectionLabel><h2 className="font-display text-4xl tracking-[-.04em] md:text-5xl">Start with the fix.</h2></div><Link href="/search" className="hidden items-center gap-1 text-sm font-bold text-primary sm:flex" data-testid="link-view-all-categories">View all <ArrowRight size={16} /></Link></div>
        {categoriesQuery.isLoading ? <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <div className="skeleton h-28 rounded-2xl" key={i} />)}</div> : categoriesQuery.isError ? <div className="mt-8"><ErrorState compact onRetry={() => categoriesQuery.refetch()} /></div> : categories.length === 0 ? <div className="mt-8"><EmptyState title="Categories are warming up" /></div> : (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{categories.slice(0, 6).map((category: Category) => <Link href={`/search?category=${category.slug}`} className="lift group rounded-2xl border border-border bg-card p-4" key={category.id} data-testid={`category-${category.id}`}><span className="mb-6 grid h-10 w-10 place-items-center rounded-xl bg-secondary text-secondary-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground"><CategoryIcon icon={category.icon} /></span><p className="text-sm font-extrabold">{category.name}</p><p className="mt-1 font-mono-ui text-[10px] text-muted-foreground">{category.providerCount} providers</p></Link>)}</div>
        )}
      </section>
      <section className="bg-foreground text-background">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <div className="flex items-end justify-between gap-4"><div><SectionLabel>Worth the short drive</SectionLabel><h2 className="font-display text-4xl tracking-[-.04em] md:text-5xl">People nearby, <em className="text-primary">ready to help.</em></h2></div><Link href="/search" className="hidden items-center gap-1 text-sm font-bold text-accent sm:flex" data-testid="link-explore-providers">Explore all <ArrowRight size={16} /></Link></div>
          <div className="mt-8">{providersQuery.isLoading ? <LoadingCards count={3} /> : providersQuery.isError ? <ErrorState compact onRetry={() => providersQuery.refetch()} /> : providers.length === 0 ? <EmptyState title="Your neighborhood is next" body="We are adding trusted providers every week. Check back soon." /> : <div className="grid gap-4 md:grid-cols-3">{providers.map((provider: ProviderProfile) => <ProviderCard key={provider.id} provider={provider} />)}</div>}</div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-20 lg:grid-cols-[.8fr_1.2fr] lg:px-8">
        <div><SectionLabel>Why FixFinder</SectionLabel><h2 className="max-w-md font-display text-4xl leading-tight tracking-[-.04em] md:text-5xl">Less guessing.<br /><span className="text-primary">More getting on with it.</span></h2></div>
        <div className="grid gap-3 sm:grid-cols-2">{[['01', 'Profiles you can trust', 'Verified providers show their face, their shop, and the work they do.'], ['02', 'A direct line', 'Call, get directions, or send a quick enquiry without bouncing through forms.'], ['03', 'Built for the neighborhood', 'Find capable people close enough to know the roads you drive every day.'], ['04', 'Clear from the start', 'Services, opening hours, and honest reviews help you choose with confidence.']].map(([number, title, body]) => <div className="rounded-2xl border border-border bg-card p-5" key={number}><span className="font-mono-ui text-xs text-primary">{number}</span><h3 className="mt-8 font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p></div>)}</div>
      </section>
      <section className="border-t border-border bg-secondary/45"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-5 py-14 sm:flex-row sm:items-center lg:px-8"><div><SectionLabel>For the people who keep us moving</SectionLabel><h2 className="font-display text-3xl tracking-[-.03em]">Own a shop or work on cars?</h2><p className="mt-2 text-sm text-muted-foreground">Build a verified presence customers can feel good about calling.</p></div><Link href="/join" className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-extrabold text-background transition-transform hover:-translate-y-0.5" data-testid="link-join-provider">Join FixFinder <ArrowRight size={17} /></Link></div></section>
      <footer className="mx-auto flex max-w-7xl items-center justify-between px-5 py-7 text-xs text-muted-foreground lg:px-8"><Logo /><span className="flex items-center gap-1.5 font-mono-ui">Built for the road ahead <span className={healthQuery.isError ? 'text-destructive' : 'text-secondary-foreground'}>●</span></span></footer>
    </main>
  </Page>;
}

function SearchPage() {
  const search = new URLSearchParams(window.location.search);
  const [q, setQ] = useState(search.get('q') || '');
  const [city, setCity] = useState(search.get('city') || '');
  const [category, setCategory] = useState(search.get('category') || '');
  const [verified, setVerified] = useState(true);
  const [openNow, setOpenNow] = useState(false);
  const [minRating, setMinRating] = useState('');
  const params = useMemo(() => ({ q: q || undefined, city: city || undefined, category: category || undefined, verified, openNow: openNow || undefined, minRating: minRating ? Number(minRating) : undefined, limit: 50 }), [q, city, category, verified, openNow, minRating]);
  const query = useListProviders(params, { query: { queryKey: getListProvidersQueryKey(params) } });
  const categoriesQuery = useListCategories({ query: { queryKey: getListCategoriesQueryKey(), staleTime: 600000 } });
  return <Page><main className="mx-auto max-w-7xl px-5 py-9 lg:px-8 lg:py-12"><div className="mb-8"><SectionLabel>Find your local expert</SectionLabel><h1 className="font-display text-4xl tracking-[-.04em] md:text-5xl">Search the network.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Filter by what you need, where you are, and who is open to help.</p></div>
    <div className="mb-7"><SearchBar initialQuery={q} initialCity={city} /></div>
    <div className="flex flex-col gap-7 lg:flex-row"><aside className="w-full shrink-0 lg:w-60"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-extrabold"><SlidersHorizontal size={16} /> Refine results</h2><button type="button" className="text-xs font-bold text-primary" onClick={() => { setQ(''); setCity(''); setCategory(''); setVerified(true); setOpenNow(false); setMinRating(''); }} data-testid="button-reset-filters">Reset</button></div><div className="mt-5 space-y-6 rounded-2xl border border-border bg-card p-4"><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Service</span><select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none" data-testid="select-category"><option value="">All services</option>{(categoriesQuery.data || []).map((item: Category) => <option value={item.slug} key={item.id}>{item.name}</option>)}</select></label><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Minimum rating</span><select value={minRating} onChange={(e) => setMinRating(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none" data-testid="select-rating"><option value="">Any rating</option><option value="4">4.0 and up</option><option value="4.5">4.5 and up</option><option value="4.8">4.8 and up</option></select></label><label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold"><span className="flex items-center gap-2"><BadgeCheck size={16} className="text-secondary-foreground" />Verified only</span><input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="h-4 w-4 accent-primary" data-testid="checkbox-verified" /></label><label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold"><span className="flex items-center gap-2"><Clock3 size={16} className="text-secondary-foreground" />Open now</span><input type="checkbox" checked={openNow} onChange={(e) => setOpenNow(e.target.checked)} className="h-4 w-4 accent-primary" data-testid="checkbox-open-now" /></label></div></aside><section className="min-w-0 flex-1"><div className="mb-4 flex items-center justify-between"><p className="text-sm text-muted-foreground">{query.isLoading ? 'Finding providers…' : <><strong className="text-foreground">{query.data?.total || 0}</strong> providers nearby</>}</p><button type="button" className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground" data-testid="button-sort"><ListFilter size={15} /> Recommended <ChevronDown size={14} /></button></div>{query.isLoading ? <LoadingCards count={6} /> : query.isError ? <ErrorState onRetry={() => query.refetch()} /> : !query.data?.items?.length ? <EmptyState /> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{query.data.items.map((provider: ProviderProfile) => <ProviderCard key={provider.id} provider={provider} />)}</div>}</section></div>
  </main></Page>;
}

function ProviderPage() {
  const { id } = useParams<{ id: string }>();
  const providerId = Number(id);
  const query = useGetProvider(providerId, { query: { queryKey: getGetProviderQueryKey(providerId), enabled: Number.isFinite(providerId) } });
  const provider = query.data;
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const enquiry = useCreateEnquiry();
  const { toast } = useToast();
  const form = useForm({ defaultValues: { name: '', phone: '', message: '' } });
  if (query.isLoading) return <Page><main className="mx-auto max-w-7xl px-5 py-12"><LoadingCards count={1} /></main></Page>;
  if (query.isError || !provider) return <Page><main className="mx-auto max-w-2xl px-5 py-20"><ErrorState onRetry={() => query.refetch()} /></main></Page>;
  const submitEnquiry = form.handleSubmit((values) => enquiry.mutate({ data: { providerId, ...values } }, { onSuccess: () => { form.reset(); setEnquiryOpen(false); toast({ title: 'Enquiry sent', description: `${provider.shopName} will be in touch soon.` }); }, onError: () => toast({ title: 'Could not send enquiry', description: 'Please try again in a moment.', variant: 'destructive' }) }));
  return <Page><main className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-12"><Link href="/search" className="mb-7 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground" data-testid="link-back-results">← Back to results</Link><div className="grid gap-7 lg:grid-cols-[1.15fr_.85fr]"><section><div className="grid h-72 grid-cols-2 gap-2 overflow-hidden rounded-3xl bg-secondary sm:h-[390px]">{provider.shopPhotos?.length ? provider.shopPhotos.slice(0, 2).map((photo, index) => <img src={photo} alt={`${provider.shopName} shop ${index + 1}`} className={`h-full w-full object-cover ${index === 0 ? 'row-span-2' : ''}`} key={photo} />) : <div className="col-span-2 row-span-2 flex items-end justify-between p-8"><span className="font-display text-7xl text-secondary-foreground">{provider.shopName.slice(0, 1)}</span><Wrench size={90} className="text-secondary-foreground/20" /></div>}</div><div className="mt-7 flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><Badge className="bg-secondary text-secondary-foreground hover:bg-secondary"><CategoryIcon icon={provider.category.icon} size={13} /> {provider.category.name}</Badge>{provider.verified && <span className="flex items-center gap-1 text-xs font-bold text-secondary-foreground"><BadgeCheck size={15} /> Verified provider</span>}</div><h1 className="mt-3 font-display text-4xl tracking-[-.04em] md:text-5xl">{provider.shopName}</h1><p className="mt-2 text-sm text-muted-foreground">{provider.name} · {provider.experienceYears} years experience</p></div><Stars value={provider.rating} count={provider.reviewCount} /></div><p className="mt-7 max-w-2xl leading-7 text-muted-foreground">{provider.description}</p><div className="mt-8 flex flex-wrap gap-2">{provider.services.map((service) => <span className="rounded-full border border-border bg-card px-3 py-2 text-xs font-bold" key={service.name}>{service.name}{service.priceFrom !== null ? <span className="ml-2 font-mono-ui text-muted-foreground">from ${service.priceFrom}</span> : null}</span>)}</div></section><aside className="lg:pl-3"><div className="sticky top-5 rounded-2xl border border-border bg-card p-5 shadow-sm"><div className={`mb-5 flex items-center gap-2 text-sm font-extrabold ${provider.availability === 'available' ? 'text-secondary-foreground' : 'text-muted-foreground'}`}><span className={`h-2.5 w-2.5 rounded-full ${provider.availability === 'available' ? 'bg-secondary-foreground' : 'bg-muted-foreground'}`} />{provider.availability === 'available' ? 'Available today' : provider.availability}</div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1"><a href={`tel:${provider.phone}`} className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-extrabold text-primary-foreground transition-transform hover:-translate-y-0.5" data-testid="button-call-provider"><Phone size={17} /> Call {provider.name.split(' ')[0]}</a><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(provider.address + ', ' + provider.city)}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3.5 text-sm font-extrabold hover:bg-muted" data-testid="button-directions"><Navigation size={17} /> Directions</a><button type="button" onClick={() => setEnquiryOpen((v) => !v)} className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3.5 text-sm font-extrabold hover:bg-muted" data-testid="button-enquiry"><MessageSquareText size={17} /> Send an enquiry</button></div>{enquiryOpen && <Form {...form}><form onSubmit={submitEnquiry} className="mt-5 border-t border-border pt-5"><p className="mb-4 text-sm font-extrabold">Ask {provider.shopName}</p><div className="space-y-3"><Input placeholder="Your name" {...form.register('name', { required: true })} data-testid="input-enquiry-name" /><Input placeholder="Phone number" {...form.register('phone', { required: true })} data-testid="input-enquiry-phone" /><Textarea placeholder="What can they help with?" {...form.register('message', { required: true, minLength: 5 })} data-testid="input-enquiry-message" /><Button type="submit" className="w-full" disabled={enquiry.isPending} data-testid="button-send-enquiry">{enquiry.isPending ? <Loader2 className="animate-spin" /> : <Send size={16} />} {enquiry.isPending ? 'Sending…' : 'Send enquiry'}</Button></div></form></Form>}<div className="mt-6 border-t border-border pt-5"><div className="flex items-start gap-3 text-sm"><MapPin className="mt-0.5 shrink-0 text-primary" size={18} /><div><p className="font-bold">{provider.address}</p><p className="text-muted-foreground">{provider.city}</p></div></div><div className="mt-4 flex items-start gap-3 text-sm"><Clock3 className="mt-0.5 shrink-0 text-primary" size={18} /><div><p className="font-bold">Hours</p><p className="text-muted-foreground">{provider.workingHours.find((h) => !h.closed)?.open} – {provider.workingHours.find((h) => !h.closed)?.close}</p></div></div></div></div></aside></div><section className="mt-16 border-t border-border pt-10"><div className="flex items-end justify-between"><div><SectionLabel>From the people they helped</SectionLabel><h2 className="font-display text-3xl tracking-[-.03em]">Recent reviews</h2></div><span className="font-mono-ui text-xs text-muted-foreground">{provider.reviewCount} TOTAL</span></div>{provider.reviews?.length ? <div className="mt-6 grid gap-3 md:grid-cols-3">{provider.reviews.map((review) => <article className="rounded-2xl border border-border bg-card p-5" key={review.id}><Stars value={review.rating} /><p className="mt-4 text-sm leading-6 text-muted-foreground">“{review.body}”</p><p className="mt-5 text-xs font-bold">{review.author}<span className="ml-2 font-normal text-muted-foreground">{new Date(review.createdAt).toLocaleDateString()}</span></p></article>)}</div> : <EmptyState title="No reviews just yet" body="Be the first person to share how it went." />}</section></main></Page>;
}

function Protected({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <Page><main className="mx-auto max-w-3xl px-5 py-16"><div className="skeleton h-80 rounded-3xl" /></main></Page>;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return <>{children}</>;
}

const defaultHours: WorkingHour[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => ({ day, open: '08:00', close: '18:00', closed: day === 'Sunday' }));

function JoinPage() {
  const mine = useGetMyProvider({ query: { queryKey: getGetMyProviderQueryKey(), retry: false } });
  const categories = useListCategories({ query: { queryKey: getListCategoriesQueryKey(), staleTime: 600000 } });
  const create = useCreateProvider();
  const update = useUpdateProvider();
  const client = useQueryClient();
  const { toast } = useToast();
  const existing = mine.data;
  const form = useForm<ProviderInput | ProviderUpdate>({ values: existing ? { name: existing.name, shopName: existing.shopName, categorySlug: existing.category.slug, serviceNames: existing.services.map((s) => s.name), experienceYears: existing.experienceYears, phone: existing.phone, address: existing.address, city: existing.city, description: existing.description, profilePhoto: existing.profilePhoto, shopPhotos: existing.shopPhotos, availability: existing.availability, workingHours: existing.workingHours } : { name: '', shopName: '', categorySlug: '', serviceNames: [], experienceYears: 0, phone: '', address: '', city: '', description: '', profilePhoto: '', shopPhotos: [], availability: 'available', workingHours: defaultHours } });
  const submit = form.handleSubmit((raw) => { const values = raw as ProviderInput; const data = { ...values, experienceYears: Number(values.experienceYears), serviceNames: (Array.isArray(values.serviceNames) ? values.serviceNames : String(values.serviceNames).split(',')).map((item) => item.trim()).filter(Boolean), shopPhotos: Array.isArray(values.shopPhotos) ? values.shopPhotos : [], workingHours: values.workingHours || defaultHours }; if (existing) update.mutate({ providerId: existing.id, data }, { onSuccess: () => { client.invalidateQueries({ queryKey: getGetMyProviderQueryKey() }); toast({ title: 'Profile saved', description: 'Your provider profile is up to date.' }); }, onError: () => toast({ title: 'Could not save profile', description: 'Check the form and try again.', variant: 'destructive' }) }); else create.mutate({ data }, { onSuccess: () => { client.invalidateQueries({ queryKey: getGetMyProviderQueryKey() }); toast({ title: 'Application received', description: 'We will review your profile shortly.' }); }, onError: () => toast({ title: 'Could not submit profile', description: 'Check the form and try again.', variant: 'destructive' }) }); });
  return <Page><Protected><main className="mx-auto max-w-5xl px-5 py-10 lg:px-8 lg:py-14"><div className="mb-8"><SectionLabel>{existing ? 'Your provider presence' : 'Join the network'}</SectionLabel><h1 className="font-display text-4xl tracking-[-.04em] md:text-5xl">{existing ? 'Keep your profile sharp.' : 'Put your work on the map.'}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{existing ? 'Customers decide quickly. Make sure they see the right details.' : 'A thoughtful profile helps the right customers find and trust you.'}</p></div>{mine.isLoading ? <div className="skeleton h-[650px] rounded-3xl" /> : <Form {...form}><form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_280px]"><div className="space-y-6"><div className="rounded-2xl border border-border bg-card p-5 sm:p-7"><h2 className="text-lg font-extrabold">The essentials</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Your name<Input {...form.register('name', { required: true })} className="mt-2" placeholder="Alex Morgan" data-testid="input-provider-name" /></label><label className="text-sm font-bold">Shop name<Input {...form.register('shopName', { required: true })} className="mt-2" placeholder="Miller & Son Auto" data-testid="input-shop-name" /></label><label className="text-sm font-bold">Service category<select {...form.register('categorySlug', { required: true })} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal" data-testid="select-provider-category"><option value="">Choose one</option>{(categories.data || []).map((category: Category) => <option value={category.slug} key={category.id}>{category.name}</option>)}</select></label><label className="text-sm font-bold">Years experience<Input type="number" {...form.register('experienceYears', { valueAsNumber: true, min: 0 })} className="mt-2" placeholder="12" data-testid="input-experience" /></label><label className="text-sm font-bold sm:col-span-2">Services <span className="font-normal text-muted-foreground">(comma separated)</span><Input defaultValue={existing?.services.map((s) => s.name).join(', ')} {...form.register('serviceNames' as never)} className="mt-2" placeholder="Brake repair, oil changes, diagnostics" data-testid="input-services" /></label><label className="text-sm font-bold">Phone<Input {...form.register('phone', { required: true })} className="mt-2" placeholder="+1 555 012 8844" data-testid="input-provider-phone" /></label><label className="text-sm font-bold">City<Input {...form.register('city', { required: true })} className="mt-2" placeholder="Portland" data-testid="input-provider-city" /></label><label className="text-sm font-bold sm:col-span-2">Address<Input {...form.register('address', { required: true })} className="mt-2" placeholder="18 Division Street" data-testid="input-provider-address" /></label></div></div><div className="rounded-2xl border border-border bg-card p-5 sm:p-7"><h2 className="text-lg font-extrabold">Your story</h2><label className="mt-5 block text-sm font-bold">Short description<Textarea {...form.register('description', { required: true, minLength: 20 })} className="mt-2 min-h-32" placeholder="Tell customers what makes your work different…" data-testid="textarea-provider-description" /></label><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Profile photo URL<Input {...form.register('profilePhoto')} className="mt-2" placeholder="https://…" data-testid="input-profile-photo" /></label><label className="text-sm font-bold">Shop photo URL <span className="font-normal text-muted-foreground">(optional)</span><Input defaultValue={existing?.shopPhotos?.[0] || ''} className="mt-2" placeholder="https://…" data-testid="input-shop-photo" /></label></div></div></div><aside className="space-y-4"><div className="rounded-2xl border border-border bg-card p-5"><p className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-muted-foreground">Profile status</p><div className="mt-4 flex items-center gap-2 text-sm font-bold"><span className={`h-2.5 w-2.5 rounded-full ${existing?.status === 'approved' ? 'bg-secondary-foreground' : 'bg-accent'}`} />{existing ? existing.status : 'Not submitted'}</div><p className="mt-3 text-xs leading-5 text-muted-foreground">Profiles are reviewed for accuracy before appearing in public search.</p></div><div className="rounded-2xl border border-secondary-border bg-secondary/60 p-5"><ShieldCheck className="text-secondary-foreground" size={22} /><h3 className="mt-4 font-bold">A verified presence</h3><p className="mt-2 text-xs leading-5 text-secondary-foreground/80">Keep your details current and earn confidence before the first call.</p></div><Button type="submit" className="h-12 w-full" disabled={create.isPending || update.isPending} data-testid="button-save-provider">{create.isPending || update.isPending ? <Loader2 className="animate-spin" /> : <Check size={16} />}{existing ? 'Save profile' : 'Submit for review'}</Button></aside></form></Form>}</main></Protected></Page>;
}

function AdminPage() {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | 'suspended' | 'all'>('pending');
  const stats = useGetDashboardStats({ query: { queryKey: getGetDashboardStatsQueryKey(), retry: false } });
  const categories = useListCategories({ query: { queryKey: getListCategoriesQueryKey(), staleTime: 600000 } });
  const list = useListAdminProviders(status === 'all' ? { status: 'all' } : { status }, { query: { queryKey: getListAdminProvidersQueryKey(status === 'all' ? { status: 'all' } : { status }), retry: false } });
  const update = useUpdateProviderStatus();
  const createCategory = useCreateAdminCategory();
  const updateCategory = useUpdateAdminCategory();
  const [newCategory, setNewCategory] = useState({ name: '', slug: '', icon: 'wrench' });
  const client = useQueryClient();
  const { toast } = useToast();
  const act = (providerId: number, next: 'approved' | 'rejected' | 'suspended' | 'pending') => update.mutate({ providerId, data: { status: next } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListAdminProvidersQueryKey(status === 'all' ? { status: 'all' } : { status }) }); client.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() }); toast({ title: `Provider ${next}`, description: 'The review queue has been updated.' }); }, onError: () => toast({ title: 'Action unavailable', description: 'Your admin session may have expired.', variant: 'destructive' }) });
  return <Page><Protected><main className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><SectionLabel>Operations desk</SectionLabel><h1 className="font-display text-4xl tracking-[-.04em] md:text-5xl">Review the network.</h1><p className="mt-2 text-sm text-muted-foreground">Approve the people customers trust to work on their cars.</p></div><span className="flex items-center gap-2 rounded-full border border-secondary-border bg-secondary/60 px-3 py-2 text-xs font-bold text-secondary-foreground"><ShieldCheck size={15} /> Admin workspace</span></div>{stats.isLoading ? <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <div className="skeleton h-28 rounded-2xl" key={i} />)}</div> : stats.isError ? <div className="mt-8"><ErrorState compact onRetry={() => stats.refetch()} /></div> : <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[['Providers', stats.data?.totalProviders], ['Verified', stats.data?.verifiedProviders], ['Pending', stats.data?.pendingProviders], ['Cities', stats.data?.citiesCovered], ['Reviews', stats.data?.totalReviews]].map(([label, value], i) => <div className={`rounded-2xl border border-border bg-card p-5 ${i === 2 ? 'border-primary/40 bg-primary/5' : ''}`} key={label as string}><p className="text-xs font-bold text-muted-foreground">{label}</p><p className="mt-4 font-display text-3xl">{value ?? '—'}</p></div>)}</div>}<section className="mt-8 rounded-2xl border border-border bg-card p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><SectionLabel>Category management</SectionLabel><h2 className="font-display text-2xl">Keep the directory useful.</h2></div><form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); createCategory.mutate({ data: newCategory }, { onSuccess: () => { setNewCategory({ name: '', slug: '', icon: 'wrench' }); client.invalidateQueries({ queryKey: getListCategoriesQueryKey() }); toast({ title: 'Category added' }); }, onError: () => toast({ title: 'Could not add category', variant: 'destructive' }) }); }}><Input value={newCategory.name} onChange={(event) => setNewCategory({ ...newCategory, name: event.target.value })} placeholder="Category name" className="w-40" /><Input value={newCategory.slug} onChange={(event) => setNewCategory({ ...newCategory, slug: event.target.value })} placeholder="slug" className="w-32" /><Button type="submit" size="sm" disabled={createCategory.isPending}>Add</Button></form></div><div className="mt-4 flex flex-wrap gap-2">{(categories.data || []).map((category: Category) => <button type="button" key={category.id} onClick={() => updateCategory.mutate({ categoryId: category.id, data: { active: true } }, { onSuccess: () => client.invalidateQueries({ queryKey: getListCategoriesQueryKey() }) })} className="rounded-full border border-border px-3 py-1.5 text-xs font-bold hover:border-primary">{category.name} <span className="ml-1 text-muted-foreground">{category.providerCount}</span></button>)}</div></section><div className="mt-10"><div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">{(['pending', 'approved', 'rejected', 'suspended', 'all'] as const).map((item) => <button type="button" onClick={() => setStatus(item)} className={`rounded-full px-3.5 py-2 text-xs font-extrabold capitalize ${status === item ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'}`} key={item} data-testid={`tab-admin-${item}`}>{item}</button>)}</div>{list.isLoading ? <div className="mt-5 space-y-3">{Array.from({ length: 4 }, (_, i) => <div className="skeleton h-28 rounded-2xl" key={i} />)}</div> : list.isError ? <div className="mt-5"><ErrorState onRetry={() => list.refetch()} /></div> : !list.data?.length ? <div className="mt-5"><EmptyState title={`No ${status === 'all' ? '' : status} profiles`} body="This part of the queue is clear." /></div> : <div className="mt-5 space-y-3">{list.data.map((provider: AdminProvider) => <div className="rounded-2xl border border-border bg-card p-4 sm:p-5" key={provider.id} data-testid={`row-admin-provider-${provider.id}`}><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div className="flex items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary font-display text-xl text-secondary-foreground">{provider.shopName.slice(0, 1)}</div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-extrabold">{provider.shopName}</h3><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">{provider.status}</span></div><p className="mt-1 text-xs text-muted-foreground">{provider.ownerEmail} · {provider.city} · Submitted {new Date(provider.submittedAt).toLocaleDateString()}</p></div></div><div className="flex flex-wrap gap-2"><Link href={`/provider/${provider.id}`} className="rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-muted" data-testid={`link-review-${provider.id}`}>Review profile</Link>{provider.status !== 'approved' && <button type="button" onClick={() => act(provider.id, 'approved')} className="rounded-lg bg-secondary px-3 py-2 text-xs font-extrabold text-secondary-foreground" disabled={update.isPending} data-testid={`button-approve-${provider.id}`}>Approve</button>}{provider.status !== 'rejected' && <button type="button" onClick={() => act(provider.id, 'rejected')} className="rounded-lg border border-primary/25 px-3 py-2 text-xs font-extrabold text-primary hover:bg-primary/5" disabled={update.isPending} data-testid={`button-reject-${provider.id}`}>Reject</button>}{provider.status !== 'suspended' && <button type="button" onClick={() => act(provider.id, 'suspended')} className="rounded-lg border border-border px-3 py-2 text-xs font-extrabold text-muted-foreground hover:bg-muted" disabled={update.isPending} data-testid={`button-suspend-${provider.id}`}>Suspend</button>}</div></div></div>)}</div>}</div></main></Protected></Page>;
}

function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const appearance = {
    theme: shadcn,
    cssLayerName: 'clerk',
    options: {
      logoPlacement: 'inside' as const,
      logoLinkUrl: basePath || '/',
      logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    },
    variables: {
      colorPrimary: '#E85D3F',
      colorForeground: '#202D35',
      colorMutedForeground: '#59636B',
      colorDanger: '#B9382D',
      colorBackground: '#FFFDF7',
      colorInput: '#FFFDF7',
      colorInputForeground: '#202D35',
      colorNeutral: '#E7DFD2',
      fontFamily: 'Manrope, sans-serif',
      borderRadius: '12px',
    },
    elements: {
      rootBox: 'w-full flex justify-center',
      cardBox: 'bg-[#FFFDF7] rounded-2xl w-[460px] max-w-full overflow-hidden',
      card: '!shadow-none !border-0 !bg-transparent !rounded-none',
      footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
      headerTitle: 'text-[#202D35] font-display',
      headerSubtitle: 'text-[#59636B]',
      socialButtonsBlockButtonText: 'text-[#202D35]',
      formFieldLabel: 'text-[#202D35]',
      footerActionLink: 'text-[#E85D3F]',
      footerActionText: 'text-[#59636B]',
      dividerText: 'text-[#59636B]',
      formButtonPrimary: 'bg-[#202D35] hover:bg-[#E85D3F]',
      formFieldInput: 'border-[#E7DFD2] bg-[#FFFDF7] text-[#202D35]',
    },
  };
  return <div className="paper-grid flex min-h-[100dvh] items-center justify-center bg-background px-5 py-10"><div className="w-full max-w-[460px]"><div className="mb-7 flex justify-center"><Logo /></div>{mode === 'sign-in' ? <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} appearance={appearance} /> : <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} appearance={appearance} />}</div></div>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={Home} /><Route path="/search" component={SearchPage} /><Route path="/provider/:id" component={ProviderPage} /><Route path="/join" component={JoinPage} /><Route path="/admin" component={AdminPage} /><Route path="/sign-in/*?" component={() => <AuthPage mode="sign-in" />} /><Route path="/sign-up/*?" component={() => <AuthPage mode="sign-up" />} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <WouterRouter base={basePath}><ClerkApp /></WouterRouter>;
}

function ClerkApp() {
  const [, setLocation] = useLocation();
  const appearance = { theme: shadcn, variables: { colorPrimary: '#E85D3F', colorForeground: '#202D35', colorBackground: '#FFFDF7', fontFamily: 'Manrope, sans-serif' } };
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} routerPush={(to) => setLocation(to.replace(basePath, '') || '/')} routerReplace={(to) => setLocation(to.replace(basePath, '') || '/', { replace: true })}><QueryClientProvider client={queryClient}><TooltipProvider><Router /><Toaster /></TooltipProvider></QueryClientProvider></ClerkProvider>;
}

export default App;