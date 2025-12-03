import { Link } from "react-router";

// export default function About() {
//   return (
//     <div className="min-h-screen p-8 bg-gray-50 text-gray-900">
//       <div className="mx-auto max-w-4xl">
//         <h1 className="mb-4 text-4xl font-bold">About Page</h1>
//         <p className="mb-6 text-gray-600">This is the about page demonstrating static routing.</p>
//         <p className="mb-4">Route: /about</p>
//         <Link to="/" className="text-blue-600 hover:underline">
//           ← Back to Home
//         </Link>
//       </div>
//     </div>
//   );
// }

export default function About() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-xl bg-white p-8 shadow-lg">
          <h1 className="mb-4 text-4xl font-bold text-gray-800">About Page</h1>
          <p className="mb-6 text-lg text-gray-600">
            This is the about page demonstrating static routing.
          </p>
          <p className="mb-4 text-gray-500">Route: /about</p>
          <Link
            to="/"
            className="inline-block font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
