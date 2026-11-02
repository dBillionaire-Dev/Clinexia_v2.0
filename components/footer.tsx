import Link from 'next/link';

export function Footer() {

  return (
    <footer className="bg-gray-900 text-white pb-3 mt-4 print:hidden">
      <div className="container mx-auto px-8">

        <div className="flex flex-col items-center justify-center space-y-4 mt-4">
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <Link
              href="https://nex.is-a.dev/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-300 transition-colors font-medium"
            >
              <span>&copy; {new Date().getFullYear()} Clinexia by NexDev</span>
            </Link>
            <span aria-hidden>·</span>
            <Link href="/about" className="hover:text-blue-300 transition-colors font-medium">About</Link>
            <span aria-hidden>·</span>
            <Link href="/privacy" className="hover:text-blue-300 transition-colors font-medium">Privacy</Link>
            <span aria-hidden>·</span>
            <Link href="/terms" className="hover:text-blue-300 transition-colors font-medium">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
