import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

interface StockRowSkeletonProps {
  index: number;
  columnVisibility: Record<string, boolean>;
  customColumnCount: number;
}

const StockRowSkeleton = ({ index, columnVisibility, customColumnCount }: StockRowSkeletonProps) => {
  const isVisible = (key: string) => columnVisibility[key] !== false;

  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="border-b border-border"
    >
      {/* Ticker */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
      </td>
      {/* Exchange */}
      {isVisible("exchange") && (
        <td className="px-3 py-3">
          <Skeleton className="h-5 w-10 rounded" />
        </td>
      )}
      {/* Price */}
      {isVisible("price") && (
        <td className="px-4 py-3 text-right">
          <Skeleton className="h-4 w-20 ml-auto" />
        </td>
      )}
      {/* Change */}
      {isVisible("change") && (
        <td className="px-4 py-3 text-right">
          <Skeleton className="h-5 w-24 ml-auto rounded" />
        </td>
      )}
      {/* High */}
      {isVisible("high") && (
        <td className="px-4 py-3 text-right hidden lg:table-cell">
          <Skeleton className="h-3 w-16 ml-auto" />
        </td>
      )}
      {/* Low */}
      {isVisible("low") && (
        <td className="px-4 py-3 text-right hidden lg:table-cell">
          <Skeleton className="h-3 w-16 ml-auto" />
        </td>
      )}
      {/* Volume */}
      {isVisible("volume") && (
        <td className="px-4 py-3 text-right hidden md:table-cell">
          <Skeleton className="h-3 w-14 ml-auto" />
        </td>
      )}
      {/* Market Cap */}
      {isVisible("marketCap") && (
        <td className="px-4 py-3 text-right hidden md:table-cell">
          <Skeleton className="h-3 w-18 ml-auto" />
        </td>
      )}
      {/* Custom columns */}
      {Array.from({ length: customColumnCount }).map((_, i) => (
        <td key={`custom-${i}`} className="px-4 py-3 text-right">
          <Skeleton className="h-3 w-12 ml-auto" />
        </td>
      ))}
      {/* Price Trigger */}
      {isVisible("priceTrigger") && (
        <td className="px-4 py-3 text-right">
          <Skeleton className="h-3 w-20 ml-auto" />
        </td>
      )}
      {/* Event */}
      {isVisible("event") && (
        <td className="px-4 py-3">
          <Skeleton className="h-4 w-16" />
        </td>
      )}
      {/* Notes */}
      {isVisible("notes") && (
        <td className="px-4 py-3">
          <Skeleton className="h-3 w-24" />
        </td>
      )}
      {/* Delete button */}
      <td className="px-3 py-3">
        <Skeleton className="h-7 w-7 rounded" />
      </td>
    </motion.tr>
  );
};

export default StockRowSkeleton;
