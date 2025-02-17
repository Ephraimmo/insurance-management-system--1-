import { fetchData } from "@/lib/data"
import { InsuranceManagementSystemClient } from "./components/InsuranceManagementSystemClient"

// This is your new server component
export default async function InsuranceManagementSystem() {
  // You can fetch data directly here
  try {
    const data = await fetchData()
    
    // Pass the data to a client component
    return <InsuranceManagementSystemClient data={data} />
  } catch (error) {
    console.error('Error fetching data:', error)
    return <InsuranceManagementSystemClient error="Failed to fetch data" />
  }
}

// Create a new file for the client component

