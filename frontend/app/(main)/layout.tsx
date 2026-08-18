import Header from "../../components/Header";
import Footer from "../../components/Footer";
import BottomNav from "../../components/BottomNav";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const [categories, branches] = await Promise.all([
    fetch('http://localhost:3001/api/categories', { cache: 'no-store' })
      .then(res => res.json())
      .catch(() => []),
    fetch('http://localhost:3001/api/home/branches', { cache: 'no-store' })
      .then(res => res.json())
      .catch(() => []),
  ]);

  return (
    <>
      <Header initialCategories={categories} initialBranches={branches} />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <Footer />
      <BottomNav />
    </>
  );
}
