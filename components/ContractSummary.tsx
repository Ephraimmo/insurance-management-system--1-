'use client';

import { useEffect, useState } from 'react';
import { getContractWithMembers } from '@/lib/contract-service';
import type { ContractWithMembers } from '@/lib/contract-service';
import { Card } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

interface ContractSummaryProps {
  contractId: string;
}

export function ContractSummary({ contractId }: ContractSummaryProps) {
  const [contract, setContract] = useState<ContractWithMembers | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContract = async () => {
      try {
        const contractData = await getContractWithMembers(contractId);
        setContract(contractData);
      } catch (error: any) {
        console.error('Error fetching contract:', error);
        setError(error.message || 'Failed to fetch contract details');
      } finally {
        setLoading(false);
      }
    };

    fetchContract();
  }, [contractId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="ml-3 text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="text-center p-4">
        <p>No contract found</p>
      </div>
    );
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Contract Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Contract Name</p>
            <p className="font-medium">{contract.contract_name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Contract Period</p>
            <p className="font-medium">
              {formatDate(contract.start_date)} - {formatDate(contract.end_date)}
            </p>
          </div>
        </div>
      </Card>

      {contract.mainMember && (
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4">Main Member</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Name</p>
              <p className="font-medium">
                {contract.mainMember.first_name} {contract.mainMember.last_name}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">ID Number</p>
              <p className="font-medium">{contract.mainMember.id_number}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Date of Birth</p>
              <p className="font-medium">{formatDate(contract.mainMember.dob)}</p>
            </div>
          </div>
        </Card>
      )}

      {contract.dependents.length > 0 && (
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4">Dependents</h3>
          <div className="space-y-4">
            {contract.dependents.map((dependent, index) => (
              <div key={dependent.member_id} className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Dependent {index + 1}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="font-medium">
                      {dependent.first_name} {dependent.last_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">ID Number</p>
                    <p className="font-medium">{dependent.id_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Date of Birth</p>
                    <p className="font-medium">{formatDate(dependent.dob)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {contract.beneficiaries.length > 0 && (
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4">Beneficiaries</h3>
          <div className="space-y-4">
            {contract.beneficiaries.map((beneficiary, index) => (
              <div key={beneficiary.member_id} className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Beneficiary {index + 1}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="font-medium">
                      {beneficiary.first_name} {beneficiary.last_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">ID Number</p>
                    <p className="font-medium">{beneficiary.id_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Date of Birth</p>
                    <p className="font-medium">{formatDate(beneficiary.dob)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
} 