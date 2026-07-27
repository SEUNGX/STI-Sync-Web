import { Receipt, CheckCircle2, XCircle, Clock, FileText } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";

const liquidations = [
  {
    id: 1,
    title: "Q1 2026 Financial Report",
    org: "JPIA",
    event: "Leadership Summit",
    amount: "₱78,450",
    allocated: "₱85,000",
    surplus: "₱6,550",
    submittedDate: "May 25, 2026",
    status: "Pending",
    receipts: 24,
  },
  {
    id: 2,
    title: "Tech Talks Expenses",
    org: "CSS",
    event: "AI & ML Seminar",
    amount: "₱11,200",
    allocated: "₱12,000",
    surplus: "₱800",
    submittedDate: "May 28, 2026",
    status: "Pending",
    receipts: 8,
  },
  {
    id: 3,
    title: "Blood Drive Liquidation",
    org: "RCY",
    event: "Blood Donation Drive",
    amount: "₱8,750",
    allocated: "₱8,500",
    surplus: "-₱250",
    submittedDate: "May 30, 2026",
    status: "Pending",
    receipts: 12,
  },
];

const approvedLiquidations = [
  {
    id: 4,
    title: "Programming Competition Expenses",
    org: "ACSS",
    event: "CodeFest 2026",
    amount: "₱42,300",
    allocated: "₱45,000",
    surplus: "₱2,700",
    approvedDate: "May 20, 2026",
    status: "Approved",
    receipts: 18,
  },
];

export function FinancialLiquidations() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#001A4D]">Financial Liquidations</h2>
        <p className="text-gray-500 text-sm">Review and approve financial reports from student organizations</p>
      </div>

      {/* Status Tabs */}
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="bg-white border border-[#E0E0E0]">
          <TabsTrigger
            value="pending"
            className="data-[state=active]:bg-[#001A4D] data-[state=active]:text-white data-[state=active]:border-b-[3px] data-[state=active]:border-[#FFC107]"
          >
            Pending Review
            <Badge className="ml-2 bg-[#FFC107] text-[#001A4D] hover:bg-[#FFC107]">3</Badge>
          </TabsTrigger>
          <TabsTrigger
            value="approved"
            className="data-[state=active]:bg-[#001A4D] data-[state=active]:text-white data-[state=active]:border-b-[3px] data-[state=active]:border-[#FFC107]"
          >
            Approved
            <Badge className="ml-2 bg-[#FFC107] text-[#001A4D] hover:bg-[#FFC107]">15</Badge>
          </TabsTrigger>
          <TabsTrigger
            value="returned"
            className="data-[state=active]:bg-[#001A4D] data-[state=active]:text-white data-[state=active]:border-b-[3px] data-[state=active]:border-[#FFC107]"
          >
            Returned for Revision
            <Badge className="ml-2 bg-[#FFC107] text-[#001A4D] hover:bg-[#FFC107]">2</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Pending Liquidations */}
        <TabsContent value="pending" className="space-y-4 mt-6">
          {liquidations.map((liquidation) => (
            <Card key={liquidation.id} className="border-[#E0E0E0] hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {/* Organization Avatar */}
                  <div className="w-12 h-12 bg-[#001A4D] rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                    {liquidation.org}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-[#001A4D] text-lg">{liquidation.title}</h3>
                        <p className="text-gray-500 text-sm">{liquidation.event}</p>
                      </div>
                      <Badge className="bg-[#FFC107] text-[#001A4D] hover:bg-[#FFC107]">
                        Pending
                      </Badge>
                    </div>

                    {/* Amount Information */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Total Expenses</p>
                        <p className="text-xl font-bold text-[#001A4D]">
                          <span className="text-[#FFC107]">₱</span>
                          {liquidation.amount.replace('₱', '')}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Allocated Budget</p>
                        <p className="text-lg font-semibold text-gray-700">{liquidation.allocated}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Surplus/Deficit</p>
                        <p className={`text-lg font-semibold ${liquidation.surplus.includes('-') ? 'text-red-600' : 'text-green-600'
                          }`}>
                          {liquidation.surplus}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Receipts</p>
                        <p className="text-lg font-semibold text-gray-700 flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          {liquidation.receipts}
                        </p>
                      </div>
                    </div>

                    {/* Timeline Stepper */}
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-[#0E4EBD] rounded-full" />
                        <span className="text-xs text-gray-600">Submitted</span>
                      </div>
                      <div className="h-0.5 w-8 bg-gray-300" />
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-[#FFC107] rounded-full animate-pulse ring-4 ring-[#FFC107]/30" />
                        <span className="text-xs font-semibold text-[#FFC107]">SAO Review</span>
                      </div>
                      <div className="h-0.5 w-8 bg-gray-300" />
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-gray-300 rounded-full" />
                        <span className="text-xs text-gray-400">Approved</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <Button className="bg-gradient-to-r from-[#22C55E] to-[#16A34A] hover:from-[#16A34A] hover:to-[#22C55E] text-white">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Approve Liquidation
                      </Button>
                      <Button className="bg-gradient-to-r from-[#EF4444] to-[#F97316] hover:from-[#F97316] hover:to-[#EF4444] text-white">
                        <XCircle className="w-4 h-4 mr-2" />
                        Return for Revision
                      </Button>
                      <Button variant="outline" className="border-[#0E4EBD] text-[#0E4EBD] hover:bg-[#E0E0E0]/50">
                        View Full Report
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Approved Liquidations */}
        <TabsContent value="approved" className="space-y-4 mt-6">
          {approvedLiquidations.map((liquidation) => (
            <Card key={liquidation.id} className="border-[#E0E0E0]">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#001A4D] rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                    {liquidation.org}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-[#001A4D] text-lg">{liquidation.title}</h3>
                        <p className="text-gray-500 text-sm">{liquidation.event}</p>
                      </div>
                      <Badge className="bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white border-0">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Approved
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Total Expenses</p>
                        <p className="text-lg font-bold text-[#001A4D]">{liquidation.amount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Allocated Budget</p>
                        <p className="text-lg font-semibold text-gray-700">{liquidation.allocated}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Surplus</p>
                        <p className="text-lg font-semibold text-green-600">{liquidation.surplus}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Approved Date</p>
                        <p className="text-sm text-gray-700">{liquidation.approvedDate}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Returned for Revision */}
        <TabsContent value="returned" className="mt-6">
          <p className="text-gray-500 text-center py-8">No liquidation reports currently returned for revision</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
