import React from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { LabelData } from '../types/printing.types';
import { PrintDialog } from './PrintDialog';
import { Printer } from 'lucide-react';

interface PrintButtonProps extends ButtonProps {
  label: LabelData;
  labelTitle?: string;
}

export const PrintButton: React.FC<PrintButtonProps> = ({ 
  label, 
  labelTitle = "Imprimir", 
  children,
  ...props 
}) => {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button 
        onClick={() => setOpen(true)} 
        {...props}
      >
        {children || (
          <>
            <Printer className="mr-2 h-4 w-4" />
            {labelTitle}
          </>
        )}
      </Button>

      <PrintDialog 
        open={open} 
        onOpenChange={setOpen} 
        label={label} 
      />
    </>
  );
};
