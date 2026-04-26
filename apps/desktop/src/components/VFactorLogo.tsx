import vfactorLogoDarkUrl from "@/assets/brands/vfactor-logo-dark.png"
import vfactorLogoLightUrl from "@/assets/brands/vfactor-logo-light.png"
import { cn } from "@/lib/utils"

interface VFactorLogoProps {
  className?: string
  imageClassName?: string
  alt?: string
}

export function VFactorLogo({
  className,
  imageClassName,
  alt = "vFactor logo",
}: VFactorLogoProps) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <img
        src={vfactorLogoLightUrl}
        alt={alt}
        className={cn("size-full object-contain dark:hidden", imageClassName)}
      />
      <img
        src={vfactorLogoDarkUrl}
        alt={alt}
        className={cn("hidden size-full object-contain dark:block", imageClassName)}
      />
    </span>
  )
}
