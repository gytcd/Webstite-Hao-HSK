import type { Metadata } from "next";
export const metadata:Metadata={title:"Hǎo · Góc học tiếng Trung",description:"Học HSK và đồng bộ trên mọi thiết bị."};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="vi"><body>{children}</body></html>}