export async function fetchData() {
  try {
    // Add your actual data fetching logic here
    return {
      someData: 'example'
    }
  } catch (error) {
    throw new Error('Failed to fetch data')
  }
} 