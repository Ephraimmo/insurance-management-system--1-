import { 
  Home, 
  FileText, 
  AlertTriangle, 
  Users, 
  BarChart2, 
  PlusCircle, 
  Search, 
  FilePlus, 
  Settings, 
  List, 
  ChevronDown, 
  FileSignature, 
  Wrench, 
  LayoutDashboard, 
  CreditCard,
  UserCog
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"

interface SidebarProps {
  setCurrentPage: (page: string) => void
  userRole?: string
}

export function Sidebar({ setCurrentPage, userRole }: SidebarProps) {
  const [isUtilityOpen, setIsUtilityOpen] = useState(false)
  const [isContractOpen, setIsContractOpen] = useState(false)
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false)
  const [isClaimsOpen, setIsClaimsOpen] = useState(false)
  const [isGeneralOpen, setIsGeneralOpen] = useState(true)

  const isAdmin = userRole === 'Admin'

  const generalItems = [
    { name: "Dashboard", icon: LayoutDashboard, page: "dashboard" },
    { name: "Customers", icon: Users, page: "customers" },
    { name: "Reports", icon: BarChart2, page: "reports" },
    { name: "Payment", icon: CreditCard, page: "payment" }
  ]

  const claimsItems = [
    { name: "New Claim", icon: PlusCircle, page: "claims" },
    { name: "Search Claims", icon: Search, page: "claimsProcessing" },
  ]

  const maintenanceItems = [
    { name: "Policies", icon: FileText, page: "policies" },
    { name: "Catering Maintenance", icon: FileText, page: "cateringMaintenance" },
  ]

  const contractItems = [
    { name: "Add Contract", icon: PlusCircle, page: "addContract" },
    { name: "Search Contract", icon: Search, page: "searchContract" },
  ]

  const utilityItems = [
    { name: "Category Maintenance", icon: List, page: "categoryMaintenance" },
    { name: "Feature Maintenance", icon: Wrench, page: "featureMaintenance" },
    { name: "User Management", icon: UserCog, page: "userManagement" }
  ]

  return (
    <div className="bg-gray-800 text-white w-64 space-y-6 py-7 px-2 absolute inset-y-0 left-0 transform -translate-x-full md:relative md:translate-x-0 transition duration-200 ease-in-out">
      <h1 className="text-2xl font-semibold text-center">Insurance System</h1>
      <nav className="space-y-1">
        {/* General Menu */}
        <div className="space-y-1">
          <Button 
            variant="ghost" 
            className="w-full justify-between py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 hover:text-white"
            onClick={() => setIsGeneralOpen(!isGeneralOpen)}
          >
            <div className="flex items-center">
              <Home className="inline-block mr-2 h-5 w-5" />
              General
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isGeneralOpen ? 'rotate-180' : ''}`} />
          </Button>

          <div className={`pl-4 space-y-1 overflow-hidden transition-all duration-200 ${isGeneralOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
            {generalItems.map((item) => (
              <a
                key={item.name}
                href="#"
                className="block py-2 px-4 rounded transition duration-200 hover:bg-gray-700 hover:text-white text-sm"
                onClick={() => setCurrentPage(item.page)}
              >
                <item.icon className="inline-block mr-2 h-4 w-4" />
                {item.name}
              </a>
            ))}
          </div>
        </div>

        {/* Claims Menu */}
        <div className="space-y-1">
          <Button 
            variant="ghost" 
            className="w-full justify-between py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 hover:text-white"
            onClick={() => setIsClaimsOpen(!isClaimsOpen)}
          >
            <div className="flex items-center">
              <AlertTriangle className="inline-block mr-2 h-5 w-5" />
              Claims
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isClaimsOpen ? 'rotate-180' : ''}`} />
          </Button>

          <div className={`pl-4 space-y-1 overflow-hidden transition-all duration-200 ${isClaimsOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
            {claimsItems.map((item) => (
              <a
                key={item.name}
                href="#"
                className="block py-2 px-4 rounded transition duration-200 hover:bg-gray-700 hover:text-white text-sm"
                onClick={() => setCurrentPage(item.page)}
              >
                <item.icon className="inline-block mr-2 h-4 w-4" />
                {item.name}
              </a>
            ))}
          </div>
        </div>

        {/* Maintenance Menu - Only show for admin */}
        {isAdmin && (
          <div className="space-y-1">
            <Button 
              variant="ghost" 
              className="w-full justify-between py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 hover:text-white"
              onClick={() => setIsMaintenanceOpen(!isMaintenanceOpen)}
            >
              <div className="flex items-center">
                <Wrench className="inline-block mr-2 h-5 w-5" />
                Maintenance
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isMaintenanceOpen ? 'rotate-180' : ''}`} />
            </Button>

            <div className={`pl-4 space-y-1 overflow-hidden transition-all duration-200 ${isMaintenanceOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
              {maintenanceItems.map((item) => (
                <a
                  key={item.name}
                  href="#"
                  className="block py-2 px-4 rounded transition duration-200 hover:bg-gray-700 hover:text-white text-sm"
                  onClick={() => setCurrentPage(item.page)}
                >
                  <item.icon className="inline-block mr-2 h-4 w-4" />
                  {item.name}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Contract Menu */}
        <div className="space-y-1">
          <Button 
            variant="ghost" 
            className="w-full justify-between py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 hover:text-white"
            onClick={() => setIsContractOpen(!isContractOpen)}
          >
            <div className="flex items-center">
              <FileSignature className="inline-block mr-2 h-5 w-5" />
              Contract
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isContractOpen ? 'rotate-180' : ''}`} />
          </Button>

          <div className={`pl-4 space-y-1 overflow-hidden transition-all duration-200 ${isContractOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
            {contractItems.map((item) => (
              <a
                key={item.name}
                href="#"
                className="block py-2 px-4 rounded transition duration-200 hover:bg-gray-700 hover:text-white text-sm"
                onClick={() => setCurrentPage(item.page)}
              >
                <item.icon className="inline-block mr-2 h-4 w-4" />
                {item.name}
              </a>
            ))}
          </div>
        </div>

        {/* Utility Menu - Only show for admin */}
        {isAdmin && (
          <div className="space-y-1">
            <Button 
              variant="ghost" 
              className="w-full justify-between py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700 hover:text-white"
              onClick={() => setIsUtilityOpen(!isUtilityOpen)}
            >
              <div className="flex items-center">
                <Settings className="inline-block mr-2 h-5 w-5" />
                Utility
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isUtilityOpen ? 'rotate-180' : ''}`} />
            </Button>

            <div className={`pl-4 space-y-1 overflow-hidden transition-all duration-200 ${isUtilityOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
              {utilityItems.map((item) => (
                <a
                  key={item.name}
                  href="#"
                  className="block py-2 px-4 rounded transition duration-200 hover:bg-gray-700 hover:text-white text-sm"
                  onClick={() => setCurrentPage(item.page)}
                >
                  <item.icon className="inline-block mr-2 h-4 w-4" />
                  {item.name}
                </a>
              ))}
            </div>
          </div>
        )}
      </nav>
    </div>
  )
}

