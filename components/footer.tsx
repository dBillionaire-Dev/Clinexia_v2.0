import Link from 'next/link';

export function Footer() {

  return (
    <footer className="border-t border-gray-800 bg-gray-900 text-white py-4 mt-4 print:hidden">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-8 text-sm text-gray-400 sm:flex-row">
        <span>&copy; {new Date().getFullYear()} Clinexia by{" "}
          <Link className="font-medium text-white underline-offset-4 hover:underline" href="https://nex.is-a.dev/" target="_blank" rel="noopener noreferrer">NexDev</Link>
        </span>
        <nav aria-label="Footer" className="flex flex-wrap justify-space-between gap-x-5 gap-y-1">
          <Link href="/about" className="hover:text-white">· About</Link>
          <Link href="/privacy" className="hover:text-white">· Privacy</Link>
          <Link href="/terms" className="hover:text-white">· Terms</Link>
        </nav>
      </div>
    </footer>
  )
}
