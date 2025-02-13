import { collection, doc, setDoc } from "firebase/firestore"
import { db } from "./FirebaseConfg"

const features = [
  {
    id: "FEX001",
    name: "24/7 Support",
    description: "Round-the-clock customer support"
  },
  {
    id: "FEX002",
    name: "No Waiting Period",
    description: "Immediate coverage from day one"
  },
  {
    id: "FEX003",
    name: "Cash Back Rewards",
    description: "Annual cash back benefits"
  },
  {
    id: "FEX004",
    name: "Family Coverage",
    description: "Extended coverage for family members"
  },
  {
    id: "FEX005",
    name: "International Coverage",
    description: "Coverage while traveling abroad"
  },
  {
    id: "FEX006",
    name: "Premium Waiver",
    description: "Premium waiver in case of disability"
  }
]

export async function setupFeatures() {
  try {
    const featuresCollection = collection(db, 'Features')
    
    // Add all features
    for (const feature of features) {
      await setDoc(doc(featuresCollection, feature.id), {
        name: feature.name,
        description: feature.description
      })
    }
    
    console.log('Features setup completed successfully')
  } catch (error) {
    console.error('Error setting up features:', error)
  }
} 