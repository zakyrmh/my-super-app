"use client";

import * as React from "react";
import { AccountCard, AccountDetailSheet } from "@/components/finance";

interface AccountWithId {
  id: string;
  name: string;
  type: string;
  balance: number;
}

interface AccountListClientProps {
  accounts: AccountWithId[];
}

export function AccountListClient({ accounts }: AccountListClientProps) {
  const [selectedAccountId, setSelectedAccountId] = React.useState<
    string | null
  >(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);

  const handleAccountClick = (accountId: string) => {
    setSelectedAccountId(accountId);
    setIsDetailOpen(true);
  };

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-thin">
        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            id={account.id}
            name={account.name}
            type={account.type}
            balance={account.balance}
            onClick={handleAccountClick}
          />
        ))}
      </div>

      <AccountDetailSheet
        accountId={selectedAccountId}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
    </>
  );
}
