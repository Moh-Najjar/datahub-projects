import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined';
import PersonOutlineOutlined from '@mui/icons-material/PersonOutlineOutlined';
import PeopleAltOutlined from '@mui/icons-material/PeopleAltOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartmentHierarchy } from '@/modules/organization/hooks/useOrganization';
import { orgPaths } from '@/modules/organization/paths';
import { buildTree, expandableIds, type TreeNode } from '@/modules/organization/utils/hierarchy';
import { visuallyHidden } from '@/modules/shared/styles';
import { Panel } from '@/modules/shared/Panel';
import { StatusChip } from '@/modules/shared/StatusChip';

/**
 * The department hierarchy as an indented, collapsible outline (nested lists with disclosure buttons).
 * Top-level departments start expanded; "Expand all" / "Collapse all" and an inactive-units switch help
 * with larger structures. No diagram library: it stays readable on phones and in RTL.
 */
export function HierarchySection() {
  const { t } = useTranslation('organization');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const query = useDepartmentHierarchy();
  const [showInactive, setShowInactive] = useState(true);

  const tree = useMemo(() => {
    const nodes = (query.data ?? []).filter((n) => showInactive || n.status === 'active');
    return buildTree(nodes, language);
  }, [query.data, showInactive, language]);

  // `null` = default: the top level is expanded.
  const [expanded, setExpanded] = useState<Set<string> | null>(null);
  const open = expanded ?? new Set(tree.map((n) => n.id));
  const toggle = (id: string) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  let body;
  if (query.isPending) {
    body = (
      <Box>
        <Box component="span" role="status" sx={visuallyHidden}>
          {tCommon('shell.loading')}
        </Box>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={44} sx={{ mb: 1 }} />
        ))}
      </Box>
    );
  } else if (query.isError) {
    body = (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => void query.refetch()}>
            {tCommon('actions.retry')}
          </Button>
        }
      >
        {t('list.loadError')}
      </Alert>
    );
  } else if (tree.length === 0) {
    body = <Typography color="text.secondary">{t('hierarchy.empty')}</Typography>;
  } else {
    body = <NodeList nodes={tree} open={open} onToggle={toggle} label={t('hierarchy.treeLabel')} />;
  }

  return (
    <Panel
      title={t('hierarchy.title')}
      subtitle={t('hierarchy.subtitle')}
      actions={
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
          <FormControlLabel control={<Switch size="small" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />} label={t('hierarchy.showInactive')} />
          <Button size="small" onClick={() => setExpanded(new Set(expandableIds(tree)))} disabled={!query.data}>
            {t('actions.expandAll')}
          </Button>
          <Button size="small" onClick={() => setExpanded(new Set())} disabled={!query.data}>
            {t('actions.collapseAll')}
          </Button>
        </Box>
      }
    >
      {body}
    </Panel>
  );
}

function NodeList({ nodes, open, onToggle, label }: { nodes: TreeNode[]; open: Set<string>; onToggle: (id: string) => void; label?: string }) {
  return (
    <Box component="ul" aria-label={label} sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {nodes.map((node) => (
        <NodeItem key={node.id} node={node} open={open} onToggle={onToggle} />
      ))}
    </Box>
  );
}

function NodeItem({ node, open, onToggle }: { node: TreeNode; open: Set<string>; onToggle: (id: string) => void }) {
  const { t } = useTranslation('organization');
  const { language } = useLanguage();
  const name = node.name[language];
  const hasChildren = node.children.length > 0;
  const isOpen = hasChildren && open.has(node.id);
  const groupId = `org-tree-${node.id}`;

  return (
    <Box component="li" sx={{ m: 0 }}>
      <Box
        sx={{
          // Toggle in a fixed column; only the text area wraps (keeps indentation on phones).
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          py: 1,
          px: 1,
          borderRadius: 1,
          opacity: node.status === 'active' ? 1 : 0.75,
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        {hasChildren ? (
          <IconButton
            size="small"
            aria-expanded={isOpen}
            aria-controls={groupId}
            aria-label={t(isOpen ? 'actions.collapse' : 'actions.expand', { name })}
            onClick={() => onToggle(node.id)}
            sx={{ ml: -0.5, mt: -0.25, flexShrink: 0 }}
          >
            <ChevronRightOutlined
              fontSize="small"
              sx={(theme) => ({
                transition: theme.transitions.create('transform', { duration: theme.transitions.duration.shortest }),
                // Points to the text direction when collapsed, down when open (mirrored in RTL).
                transform: isOpen ? 'rotate(90deg)' : theme.direction === 'rtl' ? 'scaleX(-1)' : 'none',
              })}
            />
          </IconButton>
        ) : (
          <Box sx={{ width: 30, flexShrink: 0 }} aria-hidden />
        )}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1.5, rowGap: 0.5 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, minWidth: 0, flex: '1 1 220px' }}>
          <Link component={RouterLink} to={orgPaths.department(node.id)} sx={{ fontWeight: node.depth === 0 ? 600 : 500, overflowWrap: 'anywhere' }}>
            {name}
          </Link>
          <Chip size="small" variant="outlined" label={node.code} dir="ltr" sx={{ fontFamily: 'monospace', height: 20, fontSize: 11 }} />
          {node.status === 'inactive' && <StatusChip status="inactive" />}
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 2, rowGap: 0.5, color: 'text.secondary' }}>
          <Typography variant="body2" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <PersonOutlineOutlined fontSize="inherit" aria-hidden />
            {node.manager ? t('hierarchy.manager', { name: node.manager.name[language] }) : t('overview.noManager')}
          </Typography>
          <Typography variant="body2" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <PeopleAltOutlined fontSize="inherit" aria-hidden />
            {t('hierarchy.employees', { value: formatNumber(node.totalEmployees, language) })}
          </Typography>
        </Box>
        </Box>
      </Box>
      {hasChildren && (
        <Box id={groupId} hidden={!isOpen} sx={{ ml: { xs: 2, sm: 2.5 }, pl: { xs: 1, sm: 1.5 }, borderLeft: 1, borderColor: 'divider' }}>
          {isOpen && <NodeList nodes={node.children} open={open} onToggle={onToggle} />}
        </Box>
      )}
    </Box>
  );
}
