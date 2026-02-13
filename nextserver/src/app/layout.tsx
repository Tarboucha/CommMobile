export const metadata = {
  title: 'KoDo Mobile API',
  description: 'API backend for KoDo mobile application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
