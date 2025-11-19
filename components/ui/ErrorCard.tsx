import React from 'react';
import { AlertTriangleIcon } from '../icons';
import Card from './Card';

interface ErrorCardProps {
  title: string;
  message: string;
}

const ErrorCard: React.FC<ErrorCardProps> = ({ title, message }) => {
  return (
    <Card className="border-red-500/50 dark:border-red-400/50 bg-red-50 dark:bg-red-900/20">
      <div className="p-6">
        <div className="flex items-center">
          <AlertTriangleIcon className="h-8 w-8 text-red-500 dark:text-red-400" />
          <h3 className="ml-4 text-xl font-semibold text-red-800 dark:text-red-300">{title}</h3>
        </div>
        <div className="mt-4 text-red-700 dark:text-red-300/90 space-y-2">
           <p>An error occurred while fetching data from the backend. This can often be resolved by checking the database security policies.</p>
           <p className="font-semibold">Error details:</p>
           <pre className="text-sm p-3 bg-red-100 dark:bg-red-900/30 rounded-md overflow-x-auto">
             <code>{message}</code>
           </pre>
        </div>
      </div>
    </Card>
  );
};

export default ErrorCard;
