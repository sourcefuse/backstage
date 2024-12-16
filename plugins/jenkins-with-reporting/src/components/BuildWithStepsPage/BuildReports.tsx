import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import ExternalLinkIcon from '@material-ui/icons/Launch';

const useStyles = makeStyles(theme => ({
  reportsList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  reportItem: {
    marginBottom: theme.spacing(1),
  },
  externalLinkIcon: {
    fontSize: 'inherit',
    verticalAlign: 'bottom',
    marginLeft: theme.spacing(0.5),
  },
}));

interface BuildReport {
  fileName: string;
  url: string;
}

interface BuildReportsProps {
  reports: BuildReport[];
}

const BuildReports: React.FC<BuildReportsProps> = ({ reports = [] }) => {
  const classes = useStyles();

  if (!Array.isArray(reports)) {
    return null;
  }

  return (
    <ul className={classes.reportsList}>
      {reports.map((report: BuildReport, index: number) => (
        <li key={index} className={classes.reportItem}>
          <a href={report.url} target="_blank" rel="noopener noreferrer">
            {report.fileName}
            <ExternalLinkIcon className={classes.externalLinkIcon} />
          </a>
        </li>
      ))}
    </ul>
  );
};

export default BuildReports;
