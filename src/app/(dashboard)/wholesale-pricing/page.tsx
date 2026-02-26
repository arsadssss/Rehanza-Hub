
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WholesalePricingClient } from "./wholesale-pricing-client";

/**
 * WholesalePricingPage - Server component for protection and layout.
 */
export default async function WholesalePricingPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return <WholesalePricingClient />;
}
