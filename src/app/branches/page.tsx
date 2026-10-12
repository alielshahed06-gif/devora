import { BranchDirectory } from '../../components/BranchDirectory';

export const metadata = { title: 'فروع الاستلام — Dev-X Book Store' };

export default function Page() {
  return <BranchDirectory demoFallbackEnabled={process.env.NODE_ENV !== 'production'} />;
}
