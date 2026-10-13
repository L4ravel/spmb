import AdminShellClient from './_components/AdminShellClient';

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }) {
  return <AdminShellClient>{children}</AdminShellClient>;
}
