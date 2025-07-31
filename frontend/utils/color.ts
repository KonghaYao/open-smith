const colors = [
    "bg-red-100 text-red-800 border-red-200",
    // "bg-orange-100 text-orange-800 border-orange-200",
    "bg-yellow-100 text-yellow-800 border-yellow-200",
    // "bg-lime-100 text-lime-800 border-lime-200",
    "bg-green-100 text-green-800 border-green-200",
    // "bg-teal-100 text-teal-800 border-teal-200",
    // "bg-cyan-100 text-cyan-800 border-cyan-200",
    "bg-blue-100 text-blue-800 border-blue-200",
    // "bg-indigo-100 text-indigo-800 border-indigo-200",
    // "bg-violet-100 text-violet-800 border-violet-200",
    "bg-purple-100 text-purple-800 border-purple-200",
    // "bg-pink-100 text-pink-800 border-pink-200",
    // "bg-gray-100 text-gray-800 border-gray-200",
];

function simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

export function getColorFromString(str: string): string {
    if (!str) {
        return colors[7]; // Default to gray if string is empty
    }
    const hash = simpleHash(str);
    const index = hash % colors.length;
    return colors[index];
}
