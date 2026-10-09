import Header from "../../components/Header";
import Footer from "../../components/Footer";
import BottomNav from "../../components/BottomNav";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
  const [categories, branches, settings] = await Promise.all([
    fetch(`${apiUrl}/api/categories`, { cache: 'no-store' })
      .then(res => res.json())
      .catch(() => []),
    fetch(`${apiUrl}/api/home/branches`, { cache: 'no-store' })
      .then(res => res.json())
      .catch(() => []),
    fetch(`${apiUrl}/api/home/settings`, { cache: 'no-store' })
      .then(res => res.json())
      .catch(() => null),
  ]);

  return (
    <>
      <Header initialCategories={categories} initialBranches={branches} initialSettings={settings} />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <Footer />
      <BottomNav />
    </>
  );
}
