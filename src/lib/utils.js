import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export function formatCurrency(amount, currency = 'TL') {
    const num = Number(amount) || 0;
    const curr = (currency || 'TL').toUpperCase();

    const formattedNum = num.toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    if (curr === 'USD') {
        return `$${formattedNum}`;
    }
    if (curr === 'EUR') {
        return `€${formattedNum}`;
    }
    return `₺${formattedNum}`;
}

export function formatDate(date) {
    return new Date(date).toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}
