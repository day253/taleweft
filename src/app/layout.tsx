import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'TaleWeft · 章节编辑器', description: '以文本为中心的有声剧、广播剧和有声小说编辑器交互原型。' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="zh-CN"><body>{children}</body></html>; }
