# **App Name**: Rehanza Hub

## Core Features:

- Centralized Inventory & Pricing: Manage product inventory and pricing logic from a central location, linked with the Google sheet logic provided by the user.
- Settlement Calculator: Calculates the final bank settlement amount based on product cost, promo ads, taxes, packing, shipping, and profit margins for different channels.
- Multi-Channel Integration: Sync product information, orders, and returns across multiple sales channels (Meesho, Flipkart, Amazon).
- Admin Dashboard: Provides a visual dashboard with key metrics like total orders, revenue, profit, and low stock SKUs.
- Automated Inventory Deduction: Cloud function that automatically deducts inventory upon new order creation and flags low stock alerts. This feature uses tool-like logic to make decisions based on data changes.
- Analytics Engine: Provides in-depth analytics with date filters to track orders, returns, profit, and channel performance.
- Real Profit Tracking: Tracks both expected and actual settlement amounts to account for hidden charges deducted by marketplaces. Uses tool to identify and calculate real profit.

## Style Guidelines:

- Primary color: Deep purple (#5B2EFF) for a professional and sophisticated feel, inspired by the reference layout.
- Background color: Light gray (#F5F7FA), desaturated from the primary hue, to ensure comfortable contrast with elements on the screen.
- Accent color: Emerald green (#22C55E) to indicate success and positive performance metrics.
- Headings: 'Poppins' sans-serif font with font-semibold and text-lg styles.
- Body: 'PT Sans' sans-serif font for a readable and modern appearance.
- Rounded cards with rounded-2xl radius and soft shadows (shadow-xl) for a modern UI, mirroring the reference dashboard style.
- Left vertical sidebar with a gradient purple background (bg-gradient-to-b from-purple-800 to-indigo-900) for easy navigation, consistent with the user's specification.