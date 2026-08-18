import { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  Users,
  Calendar,
  Plus,
  Edit,
  Archive,
  ArchiveRestore,
  Ban,
  CheckCircle2,
  Clock,
  Search,
  CalendarCheck,
  ShieldCheck,
} from "lucide-react";
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { CreateClubModal, useOrgMemberCountsStream } from '../../modules/organizations';
import type { OrganizationDocument } from '../../modules/organizations/types/organization.types';
import { useAdviserProfile } from '../../modules/auth';
import { formatCurrency } from '../../utils/currency';

import { useOrganizationStream } from '../../modules/organizations/hooks/useOrganizationStream';
import { useOrganizationTypes } from '../../modules/organizations/hooks/useOrganizationTypes';
import { useAllEvents } from '../../modules/events/hooks/useEventStream';
import { OrganizationDetailModal } from '../components/OrganizationDetailModal';
import { EditOrganizationModal } from '../components/EditOrganizationModal';
import { OrganizationStatusModal } from '../components/OrganizationStatusModal';

export function Organizations() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationDocument | null>(null);
  const [activeModal, setActiveModal] = useState<'detail' | 'edit' | 'status' | null>(null);
  const [statusMode, setStatusMode] = useState<'suspend' | 'archive' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  const { profile } = useAdviserProfile();
  
  // Real Firestore Streams
  const { data: rawOrganizations = [], loading: loadingOrgs } = useOrganizationStream();
  const { countsMap = {}, loading: loadingCounts } = useOrgMemberCountsStream();
  const { data: orgTypes = [] } = useOrganizationTypes();
  const { events = [], loading: loadingEvents } = useAllEvents();

  // Real-time Pending Member Applications Stream across all organizations
  const [pendingApplicationsCount, setPendingApplicationsCount] = useState<number>(0);
  const [loadingPendingApps, setLoadingPendingApps] = useState(true);

  useEffect(() => {
    const qPending = query(
      collection(db, 'organization_members'),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(
      qPending,
      (snapshot) => {
        setPendingApplicationsCount(snapshot.size);
        setLoadingPendingApps(false);
      },
      (err) => {
        console.error('Error streaming pending applications count:', err);
        setLoadingPendingApps(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const loading = loadingOrgs || loadingCounts || loadingEvents || loadingPendingApps;

  // Real Event counts mapped per organization
  const eventsCountByOrg = useMemo(() => {
    const map: Record<string, number> = {};
    events.forEach((evt) => {
      const orgId = evt.organizationId || evt.organizerId;
      if (orgId) {
        map[orgId] = (map[orgId] || 0) + 1;
      }
    });
    return map;
  }, [events]);

  // Merge live member counts
  const organizations = useMemo(() => {
    return rawOrganizations.map((org) => ({
      ...org,
      memberCount: countsMap[org.id] ?? org.memberCount ?? 0,
    }));
  }, [rawOrganizations, countsMap]);

  // Real computed summary metrics
  const activeOrgsCount = useMemo(
    () => organizations.filter((o) => o.status === 'active').length,
    [organizations]
  );
  
  const totalMembersCount = useMemo(
    () => organizations.reduce((acc, org) => acc + (Number(org.memberCount) || 0), 0),
    [organizations]
  );

  const activeEventsCount = useMemo(() => {
    return events.filter(
      (e) =>
        e.proposalStatus === 'approved' ||
        e.status === 'approved' ||
        e.status === 'ongoing' ||
        e.status === 'published'
    ).length;
  }, [events]);

  // Filtered organizations list
  const filteredOrganizations = useMemo(() => {
    return organizations.filter((org) => {
      const q = (searchQuery || '').trim().toLowerCase();
      const nameMatch = (org.name || '').toLowerCase().includes(q);
      const acronymMatch = (org.acronym || '').toLowerCase().includes(q);
      const deptMatch = (org.department || '').toLowerCase().includes(q);
      const matchesSearch = !q || nameMatch || acronymMatch || deptMatch;

      const matchesType = filterType === 'All' || org.typeId === filterType;
      const matchesStatus = filterStatus === 'All' || org.status === filterStatus;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [organizations, searchQuery, filterType, filterStatus]);

  const getOrgType = (typeId: string) => orgTypes.find((t) => t.id === typeId);

  const handleOpenDetail = (org: OrganizationDocument) => {
    setSelectedOrg(org);
    setActiveModal('detail');
  };

  const handleOpenEdit = (org: OrganizationDocument) => {
    setSelectedOrg(org);
    setActiveModal('edit');
  };

  const handleOpenStatus = (org: OrganizationDocument, mode: 'suspend' | 'archive') => {
    setSelectedOrg(org);
    setStatusMode(mode);
    setActiveModal('status');
  };

  const handleCloseModals = () => {
    setActiveModal(null);
    setSelectedOrg(null);
    setStatusMode(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#001A4D]">Organization Management</h2>
          <p className="text-gray-500 text-sm">
            Manage all recognized student clubs, memberships, and active activities
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#001A4D] hover:bg-[#0E4EBD] text-white shadow-xs"
        >
          <Plus className="w-4 h-4 mr-2 text-[#FFC107]" />
          Create Organization
        </Button>
      </div>

      {isModalOpen && (
        <CreateClubModal
          createdBy={profile?.uid ?? 'system'}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => setIsModalOpen(false)}
          isOpen={isModalOpen}
        />
      )}

      {/* Action Modals */}
      <OrganizationDetailModal
        organization={selectedOrg}
        isOpen={activeModal === 'detail'}
        onClose={handleCloseModals}
      />

      <EditOrganizationModal
        organization={selectedOrg}
        isOpen={activeModal === 'edit'}
        onClose={handleCloseModals}
      />

      <OrganizationStatusModal
        organization={selectedOrg}
        mode={statusMode}
        isOpen={activeModal === 'status'}
        onClose={handleCloseModals}
      />

      {/* Summary Stats Grid (100% Real Firestore Data) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="border-[#E0E0E0] shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center justify-between">
              <span>Total Organizations</span>
              <Building2 className="w-4 h-4 text-[#001A4D]" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-[#001A4D]">{organizations.length}</div>
            <p className="text-xs text-gray-500 mt-1">
              <span className="text-green-600 font-semibold">{activeOrgsCount}</span> active / recognized
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#E0E0E0] shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center justify-between">
              <span>Total Members</span>
              <Users className="w-4 h-4 text-[#0E4EBD]" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-[#0E4EBD]">
              {totalMembersCount.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 mt-1">Across all registered student bodies</p>
          </CardContent>
        </Card>

        <Card className="border-[#E0E0E0] shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center justify-between">
              <span>Active Events</span>
              <CalendarCheck className="w-4 h-4 text-[#0E4EBD]" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-[#0E4EBD]">{activeEventsCount}</div>
            <p className="text-xs text-gray-500 mt-1">
              Approved / scheduled campus activities
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#E0E0E0] shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center justify-between">
              <span>Pending Applications</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-amber-600">
              {pendingApplicationsCount}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Student applicants awaiting club approval
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search organizations by name, acronym, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:border-[#1E70E8] focus:ring-2 focus:ring-[#1E70E8]/20 outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm text-[#001A4D] bg-white outline-none"
            >
              <option value="All">All Types</option>
              {orgTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm text-[#001A4D] bg-white outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* Organization Cards Grid */}
      {loading ? (
        <div className="flex justify-center p-12 text-gray-400">Loading organizations...</div>
      ) : filteredOrganizations.length === 0 ? (
        <div className="text-center p-16 border-2 border-dashed rounded-2xl border-gray-200 text-gray-500 bg-white shadow-xs">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <p className="font-bold text-gray-700">No organizations found.</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {searchQuery || filterType !== 'All' || filterStatus !== 'All'
              ? 'Try clearing your filters to see more organizations.'
              : 'Click "Create Organization" to register the first student club.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrganizations.map((org) => {
            const orgType = getOrgType(org.typeId);
            const isSuspended = org.status === 'suspended';
            const isArchived = org.status === 'archived';
            const orgEventCount = eventsCountByOrg[org.id] || 0;

            return (
              <Card
                key={org.id}
                className="border-[#E0E0E0] hover:shadow-lg transition-shadow overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div
                    className="h-20 bg-gradient-to-r from-[#0E4EBD] to-[#1E70E8] relative"
                    style={orgType?.color ? { background: orgType.color } : {}}
                  >
                    <div className="absolute -bottom-8 left-6">
                      <div className="w-16 h-16 bg-[#001A4D] rounded-2xl flex items-center justify-center text-white font-bold text-lg border-4 border-white shadow-md overflow-hidden">
                        {org.logoUrl ? (
                          <img src={org.logoUrl} alt={org.acronym} className="w-full h-full object-cover" />
                        ) : (
                          org.acronym || 'ORG'
                        )}
                      </div>
                    </div>
                  </div>

                  <CardContent className="pt-10 space-y-4">
                    <div>
                      <h3 className="font-bold text-[#001A4D] text-base mb-1 truncate" title={org.name}>
                        {org.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-[#FFD54F] text-[#001A4D] hover:bg-[#FFC107] font-semibold text-xs border-0">
                          {orgType?.name || 'Student Org'}
                        </Badge>
                        <span className="text-xs text-gray-400 font-mono">({org.acronym || 'ORG'})</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Users className="w-4 h-4 text-blue-600" />
                        <span>{org.memberCount || 0} members</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-medium">
                        <Calendar className="w-4 h-4 text-[#0E4EBD]" />
                        <span>{orgEventCount} events</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                          org.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : org.status === 'suspended'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {org.status}
                      </span>
                      {org.membershipFee ? (
                        <span className="text-xs font-mono font-semibold text-gray-600">
                          Fee: {formatCurrency(org.membershipFee)}
                        </span>
                      ) : null}
                    </div>
                  </CardContent>
                </div>

                <CardContent className="pt-0">
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                    <Button
                      size="sm"
                      variant="link"
                      onClick={() => handleOpenDetail(org)}
                      className="text-[#0E4EBD] hover:text-[#1E70E8] px-0 font-bold text-xs"
                    >
                      View Details →
                    </Button>
                    <div className="flex-1" />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenEdit(org)}
                      className="p-2 h-auto hover:bg-blue-50"
                      title="Edit Organization"
                    >
                      <Edit className="w-4 h-4 text-[#1E70E8]" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenStatus(org, 'suspend')}
                      className={`p-2 h-auto ${isSuspended ? 'hover:bg-green-50' : 'hover:bg-amber-50'}`}
                      title={isSuspended ? 'Reactivate Organization' : 'Suspend Organization'}
                    >
                      {isSuspended ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <Ban className="w-4 h-4 text-[#FFC107]" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenStatus(org, 'archive')}
                      className={`p-2 h-auto ${isArchived ? 'hover:bg-blue-50' : 'hover:bg-gray-100'}`}
                      title={isArchived ? 'Unarchive Organization' : 'Archive Organization'}
                    >
                      {isArchived ? (
                        <ArchiveRestore className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Archive className="w-4 h-4 text-gray-500" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
