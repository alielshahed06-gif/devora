import Link from 'next/link';
import Image from 'next/image';
import { getPublicCatalog } from '../../server/catalog';
import { Icon } from '../../components/Icon';
export const metadata = { title: 'الأقسام — Dev-X Book Store' };
export const dynamic = 'force-dynamic';
export default async function Categories() {
  const { categories, products } = await getPublicCatalog();
  return (
    <>
      <h1>أقسام المتجر</h1>
      <div className="grid cats">{categories.map((c) => {
        const cover = products.find((p) => p.category === c.id && p.images[0]);
        const imageUrl = c.imageUrl ?? cover?.images[0];
        return <Link key={c.id} className="cat" href={`/category/${c.id}`}>{imageUrl ? <span className="ico ph"><Image src={imageUrl} alt="" fill sizes="68px" unoptimized={imageUrl.startsWith('https://')} /></span> : <span className="ico"><Icon name={c.id} /></span>}<span>{c.name}{c.description && <small>{c.description}</small>}<small>{products.filter((p) => p.category === c.id).length} منتج</small></span></Link>;
      })}</div>
      <div className="bot" id="bot">
        <div className="bot-msg"><span className="tag">Dev-X</span><h2>مستقبلك بيبدأ من هنا</h2><p>اتعلّم البرمجة والذكاء الاصطناعي بخطوات بسيطة، وكل كتاب بياخد بإيدك خطوة لقدّام.</p><Link className="bot-btn" href="/category/books">تصفّح الكتب</Link></div>
        <div className="bot-fig"><div className="bot-in" id="botIn"><Image className="botimg" src="/brand/botimg.jpg" alt="" width={440} height={440} sizes="(max-width: 700px) 34vw, 220px" /></div></div>
      </div>
    </>
  );
}
