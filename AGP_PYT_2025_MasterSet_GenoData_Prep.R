#####

setwd("C:/Users/ivanv/Desktop/UMN_Projects/PYT_Analysis/PYT2025_Selections/AGP_GenoPheno_Merge/")
source("C:/Users/ivanv/Desktop/UMN_GIT/Genotyping_Data/Agriplex_Genotyping_Results/FileConversion_Source.R")


####Geno Imp 50K for 2024

genoImp50K_24_SNPs <- read.table("CxB20_PYT24_50K_FixdRef_Imputed_GenoTable.genotypes",sep=" ",header=F)
genoImp50K_24_SNPs_Filt <- genoImp50K_24_SNPs
dim(genoImp50K_24_SNPs_Filt)
#[1]  999 36164

###
Gcve50K_SNPsTabID <- read.table("VCFIDTab_CB20_PYT24_50K_FixdRef.txt",sep = "\t",header=T)

## Add check to verify that the dimensions match and send a message to the app. 

vcfIDTab_DF_24 <- Gcve50K_SNPsTabID
vcfIDTab_DF_24$ID <- paste(vcfIDTab_DF_24$CHROM,vcfIDTab_DF_24$POS,sep="-")

genoImp50K_24_SNPs_FiltDF <- as.data.frame(genoImp50K_24_SNPs_Filt[,-1])
rownames(genoImp50K_24_SNPs_FiltDF) <- genoImp50K_24_SNPs_Filt[,1]
colnames(genoImp50K_24_SNPs_FiltDF) <- as.vector(unlist(vcfIDTab_DF_24[,"ID"]))


genoImp50K_24_SNPs_FiltDFT <- as.data.frame(t(genoImp50K_24_SNPs_FiltDF))
genoImp50K_24_SNPs_FiltDFT$ID <- as.vector(unlist(vcfIDTab_DF_24[,"ID"]))

print(dim(genoImp50K_24_SNPs_FiltDFT))
#[1] 36163  1000


genoImp50K_24_SNPs_FiltDFOut <- merge(vcfIDTab_DF_24,genoImp50K_24_SNPs_FiltDFT,by="ID")
genoImp50K_24_SNPs_FiltDFOut_Sort <- genoImp50K_24_SNPs_FiltDFOut[order(genoImp50K_24_SNPs_FiltDFOut$CHROM,genoImp50K_24_SNPs_FiltDFOut$POS),]

genoImp50K_24_SNPs_FiltDFOut_Sort[1:5,1:10]
dim(genoImp50K_24_SNPs_FiltDFOut_Sort)
#[1] 36163  1008 



## Mat sub 
genoMat <- genoImp50K_24_SNPs_FiltDFOut_Sort[,-c(1:9)]
genoMat_num0 <- apply(genoMat,2,function(x) gsub("\\b0\\b","0/0",x))
genoMat_num0b <- apply(genoMat_num0,2,function(x) gsub("\\b2\\b","1/1",x))
genoMat_num0c <- apply(genoMat_num0b,2,function(x) gsub("^1$","0/1",x))
genoMat_num <- apply(genoMat_num0c,2,function(x) gsub("NA","./.",x))

###
InfoColsTab <- genoImp50K_24_SNPs_FiltDFOut_Sort[,c(1:9)]

### Checks 

table(apply(genoMat,2,as.character))
#    0        1        2 
# 24969485  1862739  9294613 


table(genoMat_num)
# genoMat_num
#     0/0      0/1      1/1 
# 24969485  1862739  9294613

vcf_data_num <- cbind.data.frame(InfoColsTab,genoMat_num)
vcf_data_num$CHROM <- as.factor(vcf_data_num$CHROM)
vcf_data_num$POS <- as.numeric(vcf_data_num$POS)

vcf_data_num_sort <- vcf_data_num[order(vcf_data_num$CHROM,vcf_data_num$POS),]
print(dim(vcf_data_num_sort))
#[1]36163  1008

## Write complete VCF Genotyping Data

vcf_data <- vcf_data_num_sort[,c(2,3,1,c(4:ncol(vcf_data_num_sort)))]

infileVCF <- "VCFHead_V4.3_Gm" 
VCFHeader <- readVCF_Data_Head(infileVCF)

outFN <- paste("CB20_PYT_2024_50K_APImptd_a4_v1.vcf",sep="")
outFN
#Write header to file

writeLines(VCFHeader, outFN)

# Write column names to file
line1 <- paste("#", paste(colnames(vcf_data), collapse = '\t'), sep = "")
cat(line1, file = outFN, append = TRUE, "\n")
write.table(vcf_data,outFN,sep = "\t", col.names = FALSE, row.names = FALSE, quote=FALSE, append = TRUE)


####  a4_to_a6
CB20_PYT24_Imptd_Geno_Data <- vcf_data

Gcve50K_A4_to_A6_Tab <- read.table("Gcve50K_A4_to_A6_Full_XMap.txt",header=T)
Gcve50K_A4_to_A6_Tab$ChrPosA4 <- paste(Gcve50K_A4_to_A6_Tab$Chrom.A4,Gcve50K_A4_to_A6_Tab$Start.A4,sep="-")
CB20_PYT24_Imptd_Geno_Data$ChrPosA4 <- paste(CB20_PYT24_Imptd_Geno_Data$CHROM,CB20_PYT24_Imptd_Geno_Data$POS,sep="-")

### Merge Xmap with IDC_Gcve data 

CB20_PYT24_Imptd_Geno_Data_Comb <- merge(CB20_PYT24_Imptd_Geno_Data,Gcve50K_A4_to_A6_Tab,by="ChrPosA4") 
CB20_PYT24_Imptd_Geno_Data_Sort <- CB20_PYT24_Imptd_Geno_Data_Comb[order(CB20_PYT24_Imptd_Geno_Data_Comb$CHROM,CB20_PYT24_Imptd_Geno_Data_Comb$POS),] 

CB20_PYT24_Imptd_Geno_Data_A6 <- CB20_PYT24_Imptd_Geno_Data_Sort[,c("ChrPosA4","Chrom.A6","Start.A6",colnames(CB20_PYT24_Imptd_Geno_Data_Sort)[c(4:(ncol(CB20_PYT24_Imptd_Geno_Data_Sort)-4))])] 
CB20_PYT24_Imptd_Geno_Data_A6_Tab <- CB20_PYT24_Imptd_Geno_Data_A6[,-1] 
colnames(CB20_PYT24_Imptd_Geno_Data_A6_Tab)[1:2] <- c("CHROM","POS")

dim(CB20_PYT24_Imptd_Geno_Data_A6_Tab)
#[1] 36163  1008

outFN <- paste("CB20_PYT_2024_50K_APImptd_a6_v1.vcf",sep="")
outFN
#Write header to file
VCFHeader <- readVCF_Data_Head(infileVCF)
writeLines(VCFHeader,outFN)

# Write column names to file
line1 <- paste("#", paste(colnames(CB20_PYT24_Imptd_Geno_Data_A6_Tab), collapse = '\t'), sep = "")
cat(line1, file = outFN, append = TRUE, "\n")
write.table(CB20_PYT24_Imptd_Geno_Data_A6_Tab,outFN,sep = "\t", col.names = FALSE, row.names = FALSE, quote=FALSE, append = TRUE)

###

module load bcftools 
##INFO=<ID=AC,Number=A,Type=Integer,Description="Allele count in genotypes">
##INFO=<ID=AN,Number=1,Type=Integer,Description="Total number of alleles in called genotypes">
bcftools annotate -x INFO/AN,INFO/AC CB20_PYT_2024_50K_APImptd_a4_v1.vcf -o CB20_PYT_2024_50K_APImptd_a4_v1_GT.vcf
bcftools stats CB20_PYT_2024_50K_APImptd_a4_v1_GT.vcf > CB20_PYT24_50K_APImptd_Stats

#######

bcftools annotate -x INFO/AN,INFO/AC CB20_PYT_2024_50K_APImptd_a6_v1.vcf -o CB20_PYT_2024_50K_APImptd_a6_v1_GT.vcf
bcftools stats CB20_PYT_2024_50K_APImptd_a6_v1_GT.vcf > CB20_PYT24_50K_A6_APImptd_Stats

bcftools +fixref CB20_PYT_2024_50K_APImptd_a6_v1_GT.vcf -- -f ./Gmax_880_v6.0.fa   

# SC	TOP-compatible	0
# SC	BOT-compatible	0
# # ST, substitution types
# ST	A>C	1987	5.5%
# ST	A>G	7658	21.2%
# ST	A>T	0	0.0%
# ST	C>A	1697	4.7%
# ST	C>G	1	0.0%
# ST	C>T	6663	18.4%
# ST	G>A	6767	18.7%
# ST	G>C	2	0.0%
# ST	G>T	1752	4.8%
# ST	T>A	0	0.0%
# ST	T>C	7706	21.3%
# ST	T>G	1930	5.3%
# # NS, Number of sites:
# NS	total        	36163
# NS	ref match    	36126	99.9%
# NS	ref mismatch 	37	0.1%
# NS	skipped      	0
# NS	non-ACGT     	0
# NS	non-SNP      	0
# NS	non-biallelic	0


bcftools +fixref CB20_PYT_2024_50K_APImptd_a6_v1_GT.vcf -o CB20_PYT_2024_50K_APImptd_a6_v1_GT_fixRef.vcf -- -f ./Gmax_880_v6.0.fa -m flip

# SC	TOP-compatible	0
# SC	BOT-compatible	0
# # ST, substitution types
# ST	A>C	1987	5.5%
# ST	A>G	7658	21.2%
# ST	A>T	0	0.0%
# ST	C>A	1697	4.7%
# ST	C>G	1	0.0%
# ST	C>T	6663	18.4%
# ST	G>A	6767	18.7%
# ST	G>C	2	0.0%
# ST	G>T	1752	4.8%
# ST	T>A	0	0.0%
# ST	T>C	7706	21.3%
# ST	T>G	1930	5.3%
# # NS, Number of sites:
# NS	total        	36163
# NS	ref match    	36126	99.9%
# NS	ref mismatch 	37	0.1%
# NS	flipped      	15	0.0%
# NS	swapped      	17	0.0%
# NS	flip+swap    	5	0.0%
# NS	unresolved   	3	0.0%
# NS	fixed pos    	0	0.0%
# NS	skipped      	0
# NS	non-ACGT     	0
# NS	non-SNP      	0
# NS	non-biallelic	0

bcftools +fixref CB20_PYT_2024_50K_APImptd_a6_v1_GT_fixRef.vcf -- -f ./Gmax_880_v6.0.fa  

# NS,   Number of sites:
# NS	total        	36163
# NS	ref match    	36163	100.0%
# NS	ref mismatch 	0	0.0%
# NS	skipped      	0
# NS	non-ACGT     	0
# NS	non-SNP      	0
# NS	non-biallelic	0

###########################################

####Geno Imp 50K 
genoImp50K_23_Filt<- read.table("CxB19_PYT23_50K_FixdRef_Imputed_GenoTable.genotypes",sep=" ",header=T)
dim(genoImp50K_23_Filt)

Gcve50KTabID_23 <- read.table("VCFIDTab_CB19_PYT23_50K_FixdRef.txt",sep = "\t",header=T)


## Add check to verify that the dimensions match and send a message to the app. 

vcfIDTab_DF_23 <- Gcve50KTabID_23
vcfIDTab_DF_23$ID <- paste(vcfIDTab_DF_23$CHROM,vcfIDTab_DF_23$POS,sep="-")

genoImp50K_23_FiltDF <- as.data.frame(genoImp50K_23_Filt[,-1])
rownames(genoImp50K_23_FiltDF) <- genoImp50K_23_Filt[,1]
colnames(genoImp50K_23_FiltDF) <- as.vector(unlist(vcfIDTab_DF_23[,"ID"]))

genoImp50K_23_FiltDFT <- as.data.frame(t(genoImp50K_23_FiltDF))
genoImp50K_23_FiltDFT$ID <- as.vector(unlist(vcfIDTab_DF_23[,"ID"]))

# print(dim(genoImp50K_23_FiltDFT))
genoImp50K_23_FiltDFOut <- merge(vcfIDTab_DF_23,genoImp50K_23_FiltDFT,by="ID")
genoImp50K_23_FiltDFOut_Sort <- genoImp50K_23_FiltDFOut[order(genoImp50K_23_FiltDFOut$CHROM,genoImp50K_23_FiltDFOut$POS),]

dim(genoImp50K_23_FiltDFOut_Sort)
#[1] 36163  1278


length(which(genoImp50K_23_FiltDFOut_Sort[,"REF"] == genoImp50K_24_SNPs_FiltDFOut_Sort[,"REF"]))
#[1] 36163
length(which(genoImp50K_23_FiltDFOut_Sort[,"ALT"] == genoImp50K_24_SNPs_FiltDFOut_Sort[,"ALT"]))
#[1] 36163

genoMat <- apply(genoImp50K_23_FiltDFOut_Sort[,-c(1:9)],2,as.character)

##### Translate numeric code to vcf format
InfoCols <- colnames(genoImp50K_23_FiltDFOut_Sort)[1:9]
samples <- setdiff(colnames(genoImp50K_23_FiltDFOut_Sort),InfoCols)
sampleColIndx2 <- which(colnames(genoImp50K_23_FiltDFOut_Sort) %in% samples)
RefIndx <- which(colnames(genoImp50K_23_FiltDFOut_Sort) %in% "REF")
AltIndx <- which(colnames(genoImp50K_23_FiltDFOut_Sort) %in% "ALT")

# Define a function to translate genotype codes
translate_genotype_to_vcf <- function(genotype,sampleColIndx2,RefIndx,AltIndx){
  genotypeMod <- genotype
  genotypeMod[sampleColIndx2] <- gsub("NA","\\./\\.",genotypeMod[sampleColIndx2])
  genotypeMod[sampleColIndx2] <- gsub("\b0\b","0/0",genotypeMod[sampleColIndx2])
  genotypeMod[sampleColIndx2] <- gsub("\b2\b","1/1",genotypeMod[sampleColIndx2])
  genotypeMod[sampleColIndx2] <- gsub("\b1\b","0/1",genotypeMod[sampleColIndx2])
  genotypeMod[sampleColIndx2] <- gsub(" ","",genotypeMod[sampleColIndx2])
  genotypeMod
}


## Mat sub 
genoMat <- genoImp50K_23_FiltDFOut_Sort[,-c(1:9)]
genoMat_num0 <- apply(genoMat,2,function(x) gsub("\\b0\\b","0/0",x))
genoMat_num0b <- apply(genoMat_num0,2,function(x) gsub("\\b2\\b","1/1",x))
genoMat_num0c <- apply(genoMat_num0b,2,function(x) gsub("^1$","0/1",x))
genoMat_num <- apply(genoMat_num0c,2,function(x) gsub("NA","./.",x))

InfoColsTab <- genoImp50K_23_FiltDFOut_Sort[,c(1:9)]

### Checks 

table(apply(genoMat,2,as.character))
   # 0        1        2 
# 32761964  2269034 10859849 

table(genoMat_num)
# genoMat_num
     # 0/0      0/1      1/1 
# 32761964  2269034 10859849

#vcf_data_num <- do.call(rbind,lapply(c(1:nrow(genoImp50K_23_FiltDFOut_Sort)),function(x) translate_genotype_to_vcf(genoImp50K_23_FiltDFOut_Sort[x,],sampleColIndx2,RefIndx,AltIndx))) # Translate genotypes

vcf_data_num <- cbind.data.frame(InfoColsTab,genoMat_num)
vcf_data_num$CHROM <- as.factor(vcf_data_num$CHROM)
vcf_data_num$POS <- as.numeric(vcf_data_num$POS)

vcf_data_num_sort <- vcf_data_num[order(vcf_data_num$CHROM,vcf_data_num$POS),]
print(dim(vcf_data_num_sort))
#[1] 36163  1278


### Write complete VCF Genotyping Data

vcf_data <- vcf_data_num_sort[,c(2,3,1,c(4:ncol(vcf_data_num_sort)))]


readVCF_Data_Head <- function(infileVCF) {
  # Open a connection to the VCF file
  vcf_conn <- file(infileVCF, open = "r")
  
  # Initialize variables to store header lines and the column names
  header <- c()
  column_names <- NULL
  
  # Read through the file line by line
  while (TRUE) {
    line <- readLines(vcf_conn, n = 1)
    if (length(line) == 0) {
      break
    }
    if (startsWith(line, "##")) {
      # Collect meta-information header lines
      header <- c(header, line)
    } else if (startsWith(line, "#CHROM")) {
      # Capture the column names from the header line
      column_names <- unlist(strsplit(line, "\t"))
      break
    }
  }
  close.connection(vcf_conn)

 return(header)
}

infileVCF <- "VCFHead_V4.3_Gm" 
VCFHeader <- readVCF_Data_Head(infileVCF)

outFN <- paste("CB19_PYT_2023_50K_APImptd_a4_v1.vcf",sep="")
outFN
#Write header to file

writeLines(VCFHeader, outFN)

# Write column names to file
line1 <- paste("#", paste(colnames(vcf_data), collapse = '\t'), sep = "")
cat(line1, file = outFN, append = TRUE, "\n")
write.table(vcf_data,outFN,sep = "\t", col.names = FALSE, row.names = FALSE, quote=FALSE, append = TRUE)


####  a4_to_a6
CB19_PYT23_Imptd_Geno_Data <- vcf_data

Gcve50K_A4_to_A6_Tab <- read.table("Gcve50K_A4_to_A6_Full_XMap.txt",header=T)
Gcve50K_A4_to_A6_Tab$ChrPosA4 <- paste(Gcve50K_A4_to_A6_Tab$Chrom.A4,Gcve50K_A4_to_A6_Tab$Start.A4,sep="-")
CB19_PYT23_Imptd_Geno_Data$ChrPosA4 <- paste(CB19_PYT23_Imptd_Geno_Data$CHROM,CB19_PYT23_Imptd_Geno_Data$POS,sep="-")

### Merge Xmap with IDC_Gcve data 

CB19_PYT23_Imptd_Geno_Data_Comb <- merge(CB19_PYT23_Imptd_Geno_Data,Gcve50K_A4_to_A6_Tab,by="ChrPosA4") 
CB19_PYT23_Imptd_Geno_Data_Sort <- CB19_PYT23_Imptd_Geno_Data_Comb[order(CB19_PYT23_Imptd_Geno_Data_Comb$CHROM,CB19_PYT23_Imptd_Geno_Data_Comb$POS),] 

CB19_PYT23_Imptd_Geno_Data_A6 <- CB19_PYT23_Imptd_Geno_Data_Sort[,c("ChrPosA4","Chrom.A6","Start.A6",colnames(CB19_PYT23_Imptd_Geno_Data_Sort)[c(4:(ncol(CB19_PYT23_Imptd_Geno_Data_Sort)-4))])] 
CB19_PYT23_Imptd_Geno_Data_A6_Tab <- CB19_PYT23_Imptd_Geno_Data_A6[,-1] 
colnames(CB19_PYT23_Imptd_Geno_Data_A6_Tab)[1:2] <- c("CHROM","POS")

dim(CB19_PYT23_Imptd_Geno_Data_A6_Tab)
#[1] 36163  1278

outFN <- paste("CB19_PYT_2023_50K_APImptd_a6_v1.vcf",sep="")
outFN
#Write header to file
VCFHeader <- readVCF_Data_Head(infileVCF)
writeLines(VCFHeader,outFN)

# Write column names to file
line1 <- paste("#", paste(colnames(CB19_PYT23_Imptd_Geno_Data_A6_Tab), collapse = '\t'), sep = "")
cat(line1, file = outFN, append = TRUE, "\n")
write.table(CB19_PYT23_Imptd_Geno_Data_A6_Tab,outFN,sep = "\t", col.names = FALSE, row.names = FALSE, quote=FALSE, append = TRUE)

###

module load bcftools 
##INFO=<ID=AC,Number=A,Type=Integer,Description="Allele count in genotypes">
##INFO=<ID=AN,Number=1,Type=Integer,Description="Total number of alleles in called genotypes">
bcftools annotate -x INFO/AN,INFO/AC CB19_PYT_2023_50K_APImptd_a4_v1.vcf -o CB19_PYT_2023_50K_APImptd_a4_v1_GT.vcf
bcftools stats CB19_PYT_2023_50K_APImptd_a4_v1_GT.vcf > CB19_PYT23_50K_APImptd_Stats

#######

bcftools annotate -x INFO/AN,INFO/AC CB19_PYT_2023_50K_APImptd_a6_v1.vcf -o CB19_PYT_2023_50K_APImptd_a6_v1_GT.vcf
bcftools stats CB19_PYT_2023_50K_APImptd_a6_v1_GT.vcf > CB19PYT23_50K_APImp_Stats
bcftools +fixref CB19_PYT_2023_50K_APImptd_a6_v1_GT.vcf -- -f ./Gmax_880_v6.0.fa   
##
# SC	TOP-compatible	0
# SC	BOT-compatible	0
# # ST, substitution types
# ST	A>C	1987	5.5%
# ST	A>G	7658	21.2%
# ST	A>T	0	0.0%
# ST	C>A	1697	4.7%
# ST	C>G	1	0.0%
# ST	C>T	6663	18.4%
# ST	G>A	6767	18.7%
# ST	G>C	2	0.0%
# ST	G>T	1752	4.8%
# ST	T>A	0	0.0%
# ST	T>C	7706	21.3%
# ST	T>G	1930	5.3%
# # NS, Number of sites:
# NS	total        	36163
# NS	ref match    	36126	99.9%
# NS	ref mismatch 	37	0.1%
# NS	skipped      	0
# NS	non-ACGT     	0
# NS	non-SNP      	0
# NS	non-biallelic	0


bcftools +fixref CB19_PYT_2023_50K_APImptd_a6_v1_GT.vcf -o CB19_PYT_2023_50K_APImptd_a6_v1_GT_fixRef.vcf -- -f ./Gmax_880_v6.0.fa -m flip

# SC, guessed strand convention
# SC	TOP-compatible	0
# SC	BOT-compatible	0
# # ST, substitution types
# ST	A>C	1987	5.5%
# ST	A>G	7658	21.2%
# ST	A>T	0	0.0%
# ST	C>A	1697	4.7%
# ST	C>G	1	0.0%
# ST	C>T	6663	18.4%
# ST	G>A	6767	18.7%
# ST	G>C	2	0.0%
# ST	G>T	1752	4.8%
# ST	T>A	0	0.0%
# ST	T>C	7706	21.3%
# ST	T>G	1930	5.3%
# # NS, Number of sites:
# NS	total        	36163
# NS	ref match    	36126	99.9%
# NS	ref mismatch 	37	0.1%
# NS	flipped      	15	0.0%
# NS	swapped      	17	0.0%
# NS	flip+swap    	5	0.0%
# NS	unresolved   	3	0.0%
# NS	fixed pos    	0	0.0%
# NS	skipped      	0
# NS	non-ACGT     	0
# NS	non-SNP      	0
# NS	non-biallelic	0


bcftools +fixref CB19_PYT_2023_50K_APImptd_a6_v1_GT_fixRef.vcf -- -f ./Gmax_880_v6.0.fa
# SC, guessed strand convention
# SC	TOP-compatible	0
# SC	BOT-compatible	0
# # ST, substitution types
# ST	A>C	1986	5.5%
# ST	A>G	7664	21.2%
# ST	A>T	0	0.0%
# ST	C>A	1695	4.7%
# ST	C>G	1	0.0%
# ST	C>T	6663	18.4%
# ST	G>A	6762	18.7%
# ST	G>C	2	0.0%
# ST	G>T	1751	4.8%
# ST	T>A	0	0.0%
# ST	T>C	7705	21.3%
# ST	T>G	1934	5.3%
# # NS, Number of sites:
# NS	total        	36163
# NS	ref match    	36163	100.0%
# NS	ref mismatch 	0	0.0%
# NS	skipped      	0
# NS	non-ACGT     	0
# NS	non-SNP      	0
# NS	non-biallelic	0

######################################################

bcftools +fixref AGP_Soy1K_PYT_2025_a6_v1_fixRef.vcf -- -f ./Gmax_880_v6.0.fa

# TOP-compatible	0
# SC	BOT-compatible	0
# # ST, substitution types
# ST	A>C	54	4.3%
# ST	A>G	265	21.3%
# ST	A>T	0	0.0%
# ST	C>A	69	5.6%
# ST	C>G	0	0.0%
# ST	C>T	216	17.4%
# ST	G>A	234	18.8%
# ST	G>C	0	0.0%
# ST	G>T	47	3.8%
# ST	T>A	0	0.0%
# ST	T>C	277	22.3%
# ST	T>G	80	6.4%
# # NS, Number of sites:
# NS	total        	1242
# NS	ref match    	1242	100.0%
# NS	ref mismatch 	0	0.0%
# NS	skipped      	0
# NS	non-ACGT     	0
# NS	non-SNP      	0
# NS	non-biallelic	0


############################# 
module load bzip2
bgzip CB19_PYT_2023_50K_APImptd_a6_v1_GT_fixRef.vcf 
bgzip CB20_PYT_2024_50K_APImptd_a6_v1_GT_fixRef.vcf

bcftools sort CB19_PYT_2023_50K_APImptd_a6_v1_GT_fixRef.vcf.gz  -o CB19_PYT_2023_50K_APImptd_a6_v1_GT_fixRef_Srt.vcf.gz -Oz
bcftools sort CB20_PYT_2024_50K_APImptd_a6_v1_GT_fixRef.vcf.gz  -o CB20_PYT_2024_50K_APImptd_a6_v1_GT_fixRef_Srt.vcf.gz -Oz

bcftools index CB19_PYT_2023_50K_APImptd_a6_v1_GT_fixRef_Srt.vcf.gz
bcftools index CB20_PYT_2024_50K_APImptd_a6_v1_GT_fixRef_Srt.vcf.gz

##instead of using --force-samples 

bcftools query -l CB19_PYT_2023_50K_APImptd_a6_v1_GT_fixRef_Srt.vcf.gz > CB19_PYT23_Samples 
bcftools query -l CB20_PYT_2024_50K_APImptd_a6_v1_GT_fixRef_Srt.vcf.gz > CB20_PYT24_Samples 

wc -l CB19_PYT23_Samples
#1269
wc -l CB20_PYT24_Samples
#999

intersect(CB20_PYT24_Samples[,1],CB19_PYT23_Samples[,1])
[1] "E15338"     "M06-260048" "M11-105060" "M11-314101"

rmPYT23_Samples <- intersect(CB20_PYT24_Samples[,1],CB19_PYT23_Samples[,1])

write.table(rmPYT23_Samples,"PYT23_Rm_Samples.txt")
bcftools view -S ^PYT23_Rm_Samples.txt CB19_PYT_2023_50K_APImptd_a6_v1_GT_fixRef_Srt.vcf.gz -o CB19_PYT_2023_50K_APImptd_a6_v1_GT_fixRef_filt.vcf.gz -Oz


bcftools index CB19_PYT_2023_50K_APImptd_a6_v1_GT_fixRef_filt.vcf.gz
bcftools merge CB19_PYT_2023_50K_APImptd_a6_v1_GT_fixRef_filt.vcf.gz CB20_PYT_2024_50K_APImptd_a6_v1_GT_fixRef_Srt.vcf.gz -o PYT2023_24_50K_APImptd_a6_v1_GT.vcf.gz -Oz 
 
bcftools query -l AGP_Soy1K_PYT_2025_a6_v1_fixRef.vcf > PYT2025_Samples
(base) vramasub@acl08 [/scratch.global/vramasub/PYT25_MasterSet_Geno_Prep] % wc -l PYT2025_Samples 
1240 PYT2025_Samples


bgzip AGP_Soy1K_PYT_2025_a6_v1_fixRef.vcf 
bcftools sort AGP_Soy1K_PYT_2025_a6_v1_fixRef.vcf.gz -o AGP_Soy1K_PYT_2025_a6_v1_fixRef_Srt.vcf.gz -Oz
bcftools index AGP_Soy1K_PYT_2025_a6_v1_fixRef_Srt.vcf.gz
bcftools index PYT2023_24_50K_APImptd_a6_v1_GT.vcf.gz
 
 
bcftools isec -p . -Oz -n=2 PYT2023_24_50K_APImptd_a6_v1_GT.vcf.gz AGP_Soy1K_PYT_2025_a6_v1_fixRef_Srt.vcf.gz

# Renaming files

mv 0000.vcf.gz PYT2023_24_1K_APImptd_a6_v1_GT_Cmmn.vcf.gz
mv 0000.vcf.gz.tbi PYT2023_24_1K_APImptd_a6_v1_GT_Cmmn.vcf.gz.tbi

mv 0001.vcf.gz AGP_Soy1K_PYT_2025_a6_v1_fixRef_GT_Cmmn.vcf.gz
mv 0001.vcf.gz.tbi AGP_Soy1K_PYT_2025_a6_v1_fixRef_GT_Cmmn.vcf.gz.tbi

###

bcftools merge PYT2023_24_1K_APImptd_a6_v1_GT_Cmmn.vcf.gz AGP_Soy1K_PYT_2025_a6_v1_fixRef_GT_Cmmn.vcf.gz -o PYT2025_MasterSet_1K_Geno_a6_v1.vcf.gz -Oz 

gunzip PYT2025_MasterSet_1K_Geno_a6_v1.vcf.gz
bcftools query -l PYT2025_MasterSet_1K_Geno_a6_v1.vcf > PYT25_MasterSet_Samples 

#--force-samples


# Benchmark TS: PYT2025 set and Master TS with PYT2023-PYT2025 



bcftools reheader -s PYT25_Masters_Samples_Table.txt PYT2025_MasterSet_1K_Geno_a6_v1.vcf -o PYT2025_MasterSet_1K_Geno_a6_v1_RH.vcf  


cp ./PYT2025_MasterSet_1K_Geno_a6_v1_RH.vcf ~/Desktop/AGP_PYT2025/PYT25_Data 