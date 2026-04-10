
setwd("C:/Users/ivanv/Desktop/UMN_GIT/Genotyping_Data/Agriplex_Genotyping_Results/QA0136_UMN_AGP_SOY_allsamples_Genotype_Report")
source("C:/Users/ivanv/Desktop/UMN_GIT/File_Conversion_Scripts/FileConversion_Source.R")

### QA0067_UMN_AGP_Geno 
QA0136_In <- read.csv("QA0136_UOM_Soy_allsamples_Genotype_Report.csv",header=F)
dim(QA0136_In) 

REF <- QA0136_In[6,]
ALT <- QA0136_In[7,]
QA0136_Table <- QA0136_In[-c(1:7),]
colnames(QA0136_Table)[1:3] <- QA0136_In[7,c(1:3)]

colnames(QA0136_Table)[5:ncol(QA0136_Table)] <- QA0136_In[4,c(5:ncol(QA0136_In))]
dim(QA0136_Table)
#[1] 1390 1331

QA0136_Table[1:5,1:5]
AGP_QA0136_geno <- QA0136_Table[,-4]
AGP_Pop_geno <- AGP_QA0136_geno

### Replace SampleID with Alias.pedigree
## QA0136_1k_list_for_Lab  

QA0136_1k_list_for_Lab <- read.csv("2025_1k_for_agriplex_alias.csv")

# Alias_Pedigree <- QA0136_1k_list_for_Lab$Alias.pedigree[match(AGP_Pop_Geno_Filt[1,],QA0136_1k_list_for_Lab$Agriplex.Sample.name)]

QA0136_1k_list_for_Lab_Tab <- QA0136_1k_list_for_Lab[,c("Lab.Sample.ID","alias.pedigree")]

AGP_Pop_genoT <- merge(AGP_Pop_geno,QA0136_1k_list_for_Lab_Tab,by.x="Sample_ID",by.y="Lab.Sample.ID")

dim(AGP_Pop_genoT)
#[1] 1390 1331


###  Generic part 
BARC_markerColIndx <- grep("BARC",colnames(AGP_Pop_genoT)) 

## AGP trt marker panel 
trt_markerColIndx <- c((BARC_markerColIndx[length(BARC_markerColIndx)]+1):ncol(AGP_Pop_genoT))
length(trt_markerColIndx)
#[1] 86 -1(Aliaspedigree)

AliasIndx <- grep("alias.pedigree",colnames(AGP_Pop_genoT))
PlateInd <- grep("Plate",colnames(AGP_Pop_genoT))
colnames(AGP_Pop_genoT)[PlateInd] <- "Plate.name"

AGP_Pop_Geno_Filt0 <- t(AGP_Pop_genoT[,c(AliasIndx,PlateInd,BARC_markerColIndx,trt_markerColIndx)])
colnames(AGP_Pop_Geno_Filt0) <- AGP_Pop_Geno_Filt0[1,]

AliasInds <- grep("alias",rownames(AGP_Pop_Geno_Filt0))
if(length(AliasInds)>1){
  AGP_Pop_Geno_Filt <- as.data.frame(AGP_Pop_Geno_Filt0[-c(1,2,(AliasInds[length(AliasInds)])),])
}else{AGP_Pop_Geno_Filt <- as.data.frame(AGP_Pop_Geno_Filt0[-c(1,2),])}

colnames(AGP_Pop_Geno_Filt) <- gsub("_","-",colnames(AGP_Pop_Geno_Filt))
colnames(AGP_Pop_Geno_Filt)[20:30]



### 

getAGPVCF_Data <- function(AGP_Pop_Geno_Filt){

AGP_Pop_Geno_Filt$CHROM <- unlist(lapply(strsplit(rownames(AGP_Pop_Geno_Filt),"_"),function(x) x[4]))
AGP_Pop_Geno_Filt$POS <- unlist(lapply(strsplit(rownames(AGP_Pop_Geno_Filt),"_"),function(x) x[5]))
AGP_Pop_Geno_Filt$REF <- unlist(lapply(strsplit(rownames(AGP_Pop_Geno_Filt),"_"),function(x) x[6]))
AGP_Pop_Geno_Filt$ALT <- unlist(lapply(strsplit(rownames(AGP_Pop_Geno_Filt),"_"),function(x) x[7]))
AGP_Pop_Geno_Filt$ChrPosV1 <- paste(AGP_Pop_Geno_Filt$CHROM,AGP_Pop_Geno_Filt$POS,sep="-")

####

BARC_markerIDs <- grep("BARC",rownames(AGP_Pop_Geno_Filt),value=TRUE)
BARC_markerIDsInd <- grep("BARC",rownames(AGP_Pop_Geno_Filt)) 
trt_markerIDs <- rownames(AGP_Pop_Geno_Filt)[c((BARC_markerIDsInd[length(BARC_markerIDsInd)]+1):length(rownames(AGP_Pop_Geno_Filt)))]
trt_markerIDsInd <- c((BARC_markerIDsInd[length(BARC_markerIDsInd)]+1):length(rownames(AGP_Pop_Geno_Filt)))

### Extract INFO Cols in a1.v1 

INFO_Cols1 <- as.data.frame(do.call(rbind,lapply(strsplit(BARC_markerIDs,"_"),function(x) x[c(4:7)])))
colnames(INFO_Cols1) <- c("CHROM","POS","REF","ALT")
INFO_Cols1$ChrPosV1 <- paste(INFO_Cols1$CHROM,INFO_Cols1$POS,sep="-") 

INFO_Cols <- as.data.frame(do.call(rbind,lapply(strsplit(BARC_markerIDs,"_"),function(x) x[c(4:7)])))
colnames(INFO_Cols) <- c("CHROM","POS","REF","ALT")
INFO_Cols$ChrPosV1 <- paste(INFO_Cols$CHROM,INFO_Cols$POS,sep="-")


###
rownames(AGP_Pop_Geno_Filt)[c(length(rownames(AGP_Pop_Geno_Filt))-1,length(rownames(AGP_Pop_Geno_Filt)))]
AGP_Pop_Geno_Filt[trt_markerIDsInd,1:5]

AGP_Pop_Geno_Filt_Mod <- merge(INFO_Cols1,AGP_Pop_Geno_Filt,by="ChrPosV1")
colnames(AGP_Pop_Geno_Filt_Mod)[1] <- "CHROM.POS"

#### ssIDs are not provided in the AGP Genotype File. ssIDs are extracted from NUST BARCSoySNP6K  
#### data.
#### Read InfoCols from NUST_Geno.vcf BARCSoySNP6K 

infileVCF <- "NUST_Geno.vcf"
# Set the file path to the VCF file
vcf_file <- infileVCF


# Open a connection to the VCF file and skip the meta info lines
vcf_conn <- file(vcf_file, open = "r")
header <- c()
while (TRUE) {
  line <- readLines(vcf_conn, n = 1)
  if (startsWith(line, "##")) {
    header<- c(header,line)
    next
  } else {
    # Once we reach the information row, break out of the loop
    info_row <- line
    break
  }
}

# Read in the data in the VCF file, starting from the information row
NUST_Geno_vcf_data <- read.table(vcf_conn, header = FALSE)
close(vcf_conn)

# Print the information row and the first few rows of the VCF data
colnames(NUST_Geno_vcf_data) <- unlist(strsplit(info_row,"\t"))
#head(NUST_Geno_vcf_data) 

colnames(NUST_Geno_vcf_data)[1]<- "CHROM"

#####

NUST_Geno_IDs <- NUST_Geno_vcf_data[,"ID"]

NUST_Geno_vcf_data <- droplevels(NUST_Geno_vcf_data)

chr9Ind <- which(as.numeric(NUST_Geno_vcf_data$CHROM) <10)
chr10Ind <- which(as.numeric(NUST_Geno_vcf_data$CHROM) >=10)

NUST_Geno_vcf_data$CHROM[chr9Ind] <- paste("Gm0",as.numeric(NUST_Geno_vcf_data$CHROM)[chr9Ind],sep="")
NUST_Geno_vcf_data$CHROM[chr10Ind] <- paste("Gm",NUST_Geno_vcf_data$CHROM[chr10Ind],sep="")
NUST_Geno_vcf_data$ChrPosV1 <- paste(NUST_Geno_vcf_data$CHROM,NUST_Geno_vcf_data$POS,sep="-") 

### Merge NUSTGenoVCF, INFOCols

INFO_Cols_V1 <- merge(INFO_Cols,NUST_Geno_vcf_data,by="ChrPosV1",all.x=TRUE)

### 

REF_Match <- unlist(lapply(c(1:nrow(INFO_Cols_V1)),function(x) if(INFO_Cols_V1[x,"REF.x"]== INFO_Cols_V1[x,"REF.y"]){1}else{0}))
ALT_Match <- unlist(lapply(c(1:nrow(INFO_Cols_V1)),function(x) if(INFO_Cols_V1[x,"ALT.x"]== INFO_Cols_V1[x,"ALT.y"]){1}else{0}))

length(REF_Match)
length(ALT_Match)

INFO_Cols_Mod <- INFO_Cols_V1[,c("CHROM.x","POS.x","ID","REF.x","ALT.x")] 
colnames(INFO_Cols_Mod) <- c("CHROM","POS","ID","REF","ALT")
QUAL <- rep(".",nrow(INFO_Cols_Mod))
FILTER <- rep("PASS",nrow(INFO_Cols_Mod))
INFO <- rep(".",nrow(INFO_Cols_Mod))
FORMAT <- rep("GT",nrow(INFO_Cols_Mod))

INFO_Cols_Tab <- cbind.data.frame(INFO_Cols_Mod,QUAL,FILTER,INFO,FORMAT)
INFO_Cols_Tab$`CHROM.POS` <- paste(INFO_Cols_Tab$CHROM,INFO_Cols_Tab$POS,sep="-")

####
### Create INFO Cols Tab from 

AGP_Pop_Geno_Filt_VCF <- merge(INFO_Cols_Tab,AGP_Pop_Geno_Filt_Mod,by="CHROM.POS")

rmColInd <- grep("\\.[xy]",colnames(AGP_Pop_Geno_Filt_VCF))
if(length(rmColInd) >0){ rmColIndx <- c(1,rmColInd)}else{rmColIndx <- 1}

AGP_Pop_Geno_Filt_VCF$POS <- as.numeric(AGP_Pop_Geno_Filt_VCF$POS)
AGP_Pop_Geno_Filt_VCF_Mod0 <- AGP_Pop_Geno_Filt_VCF[order(AGP_Pop_Geno_Filt_VCF$CHROM,AGP_Pop_Geno_Filt_VCF$POS),-rmColIndx]
print(dim(AGP_Pop_Geno_Filt_VCF_Mod0))
#[1] 1242 1399


### Scan table for additional ALT alleles and add to ALT Field
InfoCols <- colnames(INFO_Cols_Tab)
 
scan_addALT <- function(AGP_Pop_Geno_Filt_VCF_Mod,InfoCols,nR){
	
	GenoVec <- unlist(AGP_Pop_Geno_Filt_VCF_Mod[nR,])
	GenoVecMod <- (GenoVec)
	samples <- setdiff(colnames(AGP_Pop_Geno_Filt_VCF_Mod),InfoCols)
	sampleColIndx2 <- which(colnames(AGP_Pop_Geno_Filt_VCF_Mod) %in% samples)
	
	markerVals0 <-levels(factor(GenoVec[sampleColIndx2]))
	markerVals0ModInd <- grep("/",markerVals0)
	
	if(length(markerVals0ModInd)>0){ markerVals0Mod_1 <- markerVals0[-markerVals0ModInd]}else{markerVals0Mod_1 <- markerVals0}
	
	markerVals0Mod0 <- grep("/",markerVals0,value=TRUE)
	if(length(markerVals0Mod0) >0){
	  markerVals0Mod <- gsub(" ","",markerVals0Mod0)
	  markerVals0Mod_2 <- unlist(lapply(markerVals0Mod,function(x) unlist(strsplit(x,"/"))))
	}else{markerVals0Mod_2 <- NULL}
	markerVals <- levels(factor(c(markerVals0Mod_1,markerVals0Mod_2)))
	
	markersTrueSet <- c(GenoVec[c("REF","ALT")],"FAIL")
	addtnMarkerStates <- setdiff(markerVals,markersTrueSet)
    if(length(addtnMarkerStates) >0 ){GenoVecMod["ALT"] <- paste(GenoVecMod["ALT"],paste(addtnMarkerStates,collapse=","),sep=",")}
    
	return(GenoVecMod)
}

 AGP_Pop_Geno_Filt_VCF_Mod <- do.call(rbind.data.frame,lapply(1:nrow(AGP_Pop_Geno_Filt_VCF_Mod0),function(x) scan_addALT(AGP_Pop_Geno_Filt_VCF_Mod0,InfoCols,x)))
 colnames(AGP_Pop_Geno_Filt_VCF_Mod) <- colnames(AGP_Pop_Geno_Filt_VCF_Mod0)

##### Translate allelic code to numeric code
InfoCols <- colnames(INFO_Cols_Tab)
samples <- setdiff(colnames(AGP_Pop_Geno_Filt_VCF_Mod),InfoCols)
sampleColIndx2 <- which(colnames(AGP_Pop_Geno_Filt_VCF_Mod) %in% samples)
RefIndx <- which(colnames(AGP_Pop_Geno_Filt_VCF_Mod) %in% "REF")
AltIndx <- which(colnames(AGP_Pop_Geno_Filt_VCF_Mod) %in% "ALT")

# Define a function to translate genotype codes
translate_genotype_vcf_num <- function(genotype,sampleColIndx2,RefIndx,AltIndx){
  genotypeMod <- genotype
  HomIndx <- grep("/",genotypeMod[sampleColIndx2],invert=TRUE)
  HetIndx <- grep("/",genotypeMod[sampleColIndx2],invert=FALSE)
 
  ## FAIL
  genotypeMod[sampleColIndx2] <- gsub("FAIL","\\./\\.",genotypeMod[sampleColIndx2])
  
  ## REF
  genotypeMod[sampleColIndx2] <- gsub(as.character(genotypeMod[RefIndx]),"0",genotypeMod[sampleColIndx2])
  genotypeMod[sampleColIndx2][HomIndx] <- gsub("0","0/0",genotypeMod[sampleColIndx2][HomIndx])
  
  
  ## ALT 
  if(length(grep(",",genotypeMod[AltIndx]))>0){
     AltState <- unlist(strsplit(as.character(genotypeMod[AltIndx]),",")[[1]])
  }else{AltState <- genotypeMod[AltIndx]} 
  
  AltState <- gsub(" ","",AltState)
  
  for(nAlt in 1:length(AltState)){
  #genotypeMod[sampleColIndx2] <- gsub(genotypeMod[AltIndx],"1",genotypeMod[sampleColIndx2])
   genotypeMod[sampleColIndx2] <- gsub(AltState[nAlt],as.character(nAlt),genotypeMod[sampleColIndx2])
  }
  for(nAlt in 1:length(AltState)){
   genotypeMod[sampleColIndx2][HomIndx] <- gsub(as.character(nAlt),paste(as.character(nAlt),"/",as.character(nAlt),sep=""),genotypeMod[sampleColIndx2][HomIndx])
  }
  
  genotypeMod[sampleColIndx2][HetIndx] <- gsub(" ","",genotypeMod[sampleColIndx2][HetIndx])
  genotypeMod
}

# # translate_genotype_vcf_num(AGP_Pop_Geno_Filt_VCF_Mod[1,],sampleColIndx2,RefIndx,AltIndx)
# vcf_data_num <- AGP_Pop_Geno_Filt_VCF_Mod
# for(x in 1:nrow(AGP_Pop_Geno_Filt_VCF_Mod)){ 
 # vcf_data_num[x,] <- translate_genotype_vcf_num(AGP_Pop_Geno_Filt_VCF_Mod[x,],sampleColIndx2,RefIndx,AltIndx)
# }

### Translate genotypes for all samples into numeric code

vcf_data_num <- do.call(rbind,lapply(c(1:nrow(AGP_Pop_Geno_Filt_VCF_Mod)),function(x)translate_genotype_vcf_num(AGP_Pop_Geno_Filt_VCF_Mod[x,],sampleColIndx2,RefIndx,AltIndx))) # Translate genotypes
vcf_data_num$CHROM <- as.factor(vcf_data_num$CHROM)
vcf_data_num$POS <- as.numeric(vcf_data_num$POS)

vcf_data_num_sort <- vcf_data_num[order(vcf_data_num$CHROM,vcf_data_num$POS),]
print(dim(vcf_data_num_sort))
#[1] 1242 1399
print(table(apply(vcf_data_num_sort[,sampleColIndx2],2,as.character)))
# ./.    0/0    0/1    1/1 
# 141039 902964 128148 554229 

### Write complete VCF 
#### AGP Genotyping Plate 


vcf_data <- vcf_data_num_sort
colCHR <- grep("CHR",colnames(vcf_data))
colFmt <- grep("FORMAT",colnames(vcf_data))
AGP_Geno_Data <- vcf_data

###Filter Markers 
### Filt 1: Rm markers with NA IDs
Filt1_Ind <- which(is.na(AGP_Geno_Data[,"ID"]))
if(length(Filt1_Ind)>0){AGP_Geno_Data_Out_Filt1 <- AGP_Geno_Data[-Filt1_Ind,]}else{AGP_Geno_Data_Out_Filt1 <- AGP_Geno_Data}

### Filt2 Rm markers with duplicated IDs
Filt2_Ind <- which(duplicated(AGP_Geno_Data_Out_Filt1[,"ID"]))
if(length(Filt2_Ind)>0){AGP_Geno_Data_Out_Filt2 <- AGP_Geno_Data_Out_Filt1[-Filt2_Ind,]}else{AGP_Geno_Data_Out_Filt2 <- AGP_Geno_Data_Out_Filt1}
AGP_Geno_Data_Out_Filt2$CHROM <- gsub("Gm[0]*","",AGP_Geno_Data_Out_Filt2$CHROM)

scaffoldInd <- grep("scaffold",AGP_Geno_Data_Out_Filt2$CHROM)
if(length(scaffoldInd)>0){AGP_Geno_Data_Out_Filt3 <- AGP_Geno_Data_Out_Filt2[-scaffoldInd,]}else{AGP_Geno_Data_Out_Filt3 <- AGP_Geno_Data_Out_Filt2}
 
print(length(samples))
#[1] 1390
print(dim(AGP_Geno_Data_Out_Filt3))
#[1] 1242 1399


###

return(AGP_Geno_Data_Out_Filt3)
}


# ./.    0/0    0/1    1/1 
# 141039 902964 128148 554229 

AGP_Geno_Data_Out_Filt3 <- getAGPVCF_Data(AGP_Pop_Geno_Filt)



# Check
## table(apply(AGP_Geno_Data_Out_Filt3[,c(10:ncol(AGP_Geno_Data_Out_Filt3))],2,as.character))

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


 infileVCF <- "VCF_glyma_a1_v1_head" 
 VCFHeader <- readVCF_Data_Head(infileVCF)



outFN <- paste("AGP_2025_Assay_Genotypes_a1_v1.vcf",sep="")
outFN
#Write header to file

writeLines(VCFHeader, outFN)

# Write column names to file
line1 <- paste("#", paste(colnames(AGP_Geno_Data_Out_Filt3), collapse = '\t'), sep = "")
cat(line1, file = outFN, append = TRUE, "\n")
write.table(AGP_Geno_Data_Out_Filt3,outFN,sep = "\t", col.names = FALSE, row.names = FALSE, quote=FALSE, append = TRUE)

######
table(QA0136_1k_list_for_Lab$project)
#  NA		  CB21    CB25   PYT25 PYTRR25 
# 504     104      46    1164     102 

PYTSamplesInd <- grep("PYT",QA0136_1k_list_for_Lab$project)
NUSTSamplesInd <- grep("NUST",QA0136_1k_list_for_Lab$project)

CB25SamplesInd <- grep("CB25",QA0136_1k_list_for_Lab$project)
CB21SamplesInd <- grep("CB21",QA0136_1k_list_for_Lab$project)

length(PYTSamplesInd)
#[1] 1266

length(CB21SamplesInd)
#[1] 104

length(CB25SamplesInd)
#[1] 46
 

## Subset VCF for these samples 

CB2025_Samples <- QA0136_1k_list_for_Lab$alias.pedigree[CB25SamplesInd]
CB2021_Samples <- QA0136_1k_list_for_Lab$alias.pedigree[CB21SamplesInd]

PYT2025Samples <-  QA0136_1k_list_for_Lab$alias.pedigree[PYTSamplesInd]

#NUST2024Samples <-  QA0136_1k_list_for_Lab$Alias.pedigree[NUSTSamplesInd] 

write.table(PYT2025Samples,"PYT2025_Samples",quote=FALSE,sep="\t",row.names=F)

###

length(unique(PYT2025Samples))
#[1] 1241

InfoCols_VCF <- InfoCols[-length(InfoCols)]
AGP_CB2025_Geno_Data_Out_Filt3 <- AGP_Geno_Data_Out_Filt3[,which(colnames(AGP_Geno_Data_Out_Filt3) %in% c(InfoCols_VCF,CB2025_Samples))]
AGP_CB2021_Geno_Data_Out_Filt3 <- AGP_Geno_Data_Out_Filt3[,which(colnames(AGP_Geno_Data_Out_Filt3) %in% c(InfoCols_VCF,CB2021_Samples))]
AGP_PYT2025_Geno_Data_Out_Filt3 <- AGP_Geno_Data_Out_Filt3[,which(colnames(AGP_Geno_Data_Out_Filt3) %in% c(InfoCols_VCF,PYT2025Samples))]

#AGP_NUST2024_Geno_Data_Out_Filt3 <- AGP_Geno_Data_Out_Filt3[,which(colnames(AGP_Geno_Data_Out_Filt3) %in% c(InfoCols_VCF,NUST2024Samples))]

 
 dim(AGP_PYT2025_Geno_Data_Out_Filt3)
#[1] 1242 1249
 dim(AGP_CB2021_Geno_Data_Out_Filt3)
#[1] 1242  106

 dim(AGP_CB2025_Geno_Data_Out_Filt3)
# [1] 1242   51

###
outFN1 <- paste("AGP_PYT_2025_Genotypes_a1_v1.vcf",sep="")
outFN1
#Write header to file

writeLines(VCFHeader, outFN1)

# Write column names to file
line1 <- paste("#", paste(colnames(AGP_PYT2025_Geno_Data_Out_Filt3), collapse = '\t'), sep = "")
cat(line1, file = outFN1, append = TRUE, "\n")
write.table(AGP_PYT2025_Geno_Data_Out_Filt3,outFN1,sep = "\t", col.names = FALSE, row.names = FALSE, quote=FALSE, append = TRUE)

###

OutFN2 <- paste("AGP_CxB_2021_Genotypes_a1_v1.vcf",sep="")
OutFN2
#Write header to file

writeLines(VCFHeader, OutFN2)

# Write column names to file
line1 <- paste("#", paste(colnames(AGP_CB2021_Geno_Data_Out_Filt3), collapse = '\t'), sep = "")
cat(line1, file = OutFN2, append = TRUE, "\n")
write.table(AGP_CB2021_Geno_Data_Out_Filt3,OutFN2,sep = "\t", col.names = FALSE, row.names = FALSE, quote=FALSE, append = TRUE)

### 


OutFN3 <- paste("AGP_CxB_2025_Genotypes_a1_v1.vcf",sep="")
OutFN3
#Write header to file

writeLines(VCFHeader, OutFN3)

# Write column names to file
line1 <- paste("#", paste(colnames(AGP_CB2025_Geno_Data_Out_Filt3), collapse = '\t'), sep = "")
cat(line1, file = OutFN3, append = TRUE, "\n")
write.table(AGP_CB2025_Geno_Data_Out_Filt3,OutFN3,sep = "\t", col.names = FALSE, row.names = FALSE, quote=FALSE, append = TRUE)


################

module load bcftools
bgzip AGP_PYT_2025_Genotypes_a1_v1.vcf
bcftools tabix AGP_PYT_2025_Genotypes_a1_v1.vcf.gz 
bcftools stats AGP_PYT_2025_Genotypes_a1_v1.vcf.gz > AGP_PYT_2025_Stats

bcftools query -f "%CHROM\t%POS\t%REF\t%ALT\n" AGP_PYT_2025_Genotypes_a1_v1.vcf.gz > AGP_PYT_2025_CHRPOS
bcftools norm --check-ref ws -f ../Gmax.a1.v1.noGmPrefix.fasta AGP_PYT_2025_Genotypes_a1_v1.vcf.gz -o AGP_PYT_2025_Genotypes_a1_v1_checked.vcf.gz -Oz
# Lines   total/split/realigned/skipped:	1242/0/0/0
# REF/ALT total/modified/added:  	1242/0/0


### Convert a1 to a6: 



############ AGP 1K PYT a1_v1 to a6_v1 coordinates

AGP_Soy1K_A1_to_A6_Full_XMap.txt


source("~/File_Conversion_Scripts/FileConversion_Source.R")


##### AGP_PYT_2021_2024_Genotypes_a1_v1.vcf 

infileVCF <- "AGP_PYT_2025_Genotypes_a1_v1.vcf"
AGP_PYT_Geno_Data_VCF <- readVCF_Data(infileVCF)
dim(AGP_PYT_Geno_Data_VCF$vcf_data)

AGP_PYT_Geno_Data_Out_Filt <- AGP_PYT_Geno_Data_VCF$vcf_data
AGP_PYT_Geno_Data_Out_Header <- AGP_PYT_Geno_Data_VCF$header  
colnames(AGP_PYT_Geno_Data_Out_Filt) <- gsub("#","",colnames(AGP_PYT_Geno_Data_Out_Filt))



chr9Ind <- which(as.numeric(AGP_PYT_Geno_Data_Out_Filt$CHROM) <10)
chr10Ind <- which(as.numeric(AGP_PYT_Geno_Data_Out_Filt$CHROM) >=10)

AGP_PYT_Geno_Data_Out_Filt$CHROM[chr9Ind] <- paste("Gm0",as.numeric(AGP_PYT_Geno_Data_Out_Filt$CHROM)[chr9Ind],sep="")
AGP_PYT_Geno_Data_Out_Filt$CHROM[chr10Ind] <- paste("Gm",AGP_PYT_Geno_Data_Out_Filt$CHROM[chr10Ind],sep="")
AGP_PYT_Geno_Data_Out_Filt$ChrPosA1 <- paste(AGP_PYT_Geno_Data_Out_Filt$CHROM,AGP_PYT_Geno_Data_Out_Filt$POS,sep="-")

AGP1K_A1_to_A6_Tab <- read.table("~/Desktop/LiftOverTools/AGP_Soy1K_A1_to_A6_Full_XMap.txt",header=T)
AGP1K_A1_to_A6_Tab$ChrPosA1 <- paste(AGP1K_A1_to_A6_Tab$Chrom.A1,AGP1K_A1_to_A6_Tab$Start.A1,sep="-")


## Merge Xmap with Geno data 
AGP_PYT_Geno_Data_Out_Filt_Comb <- merge(AGP_PYT_Geno_Data_Out_Filt,AGP1K_A1_to_A6_Tab,by="ChrPosA1") 

AGP_PYT_Geno_Data_Out_Filt_Comb_Sort <- AGP_PYT_Geno_Data_Out_Filt_Comb[order(AGP_PYT_Geno_Data_Out_Filt_Comb$CHROM,AGP_PYT_Geno_Data_Out_Filt_Comb$POS),] 

AGP_PYT_Geno_Data_Out_Filt_A6 <- AGP_PYT_Geno_Data_Out_Filt_Comb_Sort[,c("ChrPosA1","Chrom.A6","Start.A6",colnames(AGP_PYT_Geno_Data_Out_Filt_Comb_Sort)[c(4:(ncol(AGP_PYT_Geno_Data_Out_Filt_Comb_Sort)-4))])] 

AGP_PYT_Geno_Data_Out_Filt_A6_Tab <- AGP_PYT_Geno_Data_Out_Filt_A6[,-1] 
colnames(AGP_PYT_Geno_Data_Out_Filt_A6_Tab)[1:2] <- c("CHROM","POS")


outFN <- paste("AGP_Soy1K_PYT_2025_a6_v1.vcf",sep="")
outFN
#Write header to file
VCFHeader <- AGP_PYT_Geno_Data_Out_Header
writeLines(VCFHeader, outFN)

# Write column names to file
line1 <- paste("#", paste(colnames(AGP_PYT_Geno_Data_Out_Filt_A6_Tab), collapse = '\t'), sep = "")
cat(line1, file = outFN, append = TRUE, "\n")
write.table(AGP_PYT_Geno_Data_Out_Filt_A6_Tab,outFN,sep = "\t", col.names = FALSE, row.names = FALSE, quote=FALSE, append = TRUE)


####


bcftools annotate -x INFO/AN,INFO/AC AGP_Soy1K_PYT_2025_a6_v1.vcf -o AGP_Soy1K_PYT_2025_a6_v1_GT.vcf
bcftools stats AGP_Soy1K_PYT_2025_a6_v1.vcf

bcftools +fixref AGP_Soy1K_PYT_2025_a6_v1.vcf -- -f ~/Desktop/Gmax_880_v6.0.fa  

# # SC, guessed strand convention
# SC	TOP-compatible	0
# SC	BOT-compatible	0
# # ST, substitution types
# ST	A>C	53	4.3%
# ST	A>G	269	21.7%
# ST	A>T	0	0.0%
# ST	C>A	71	5.7%
# ST	C>G	0	0.0%
# ST	C>T	208	16.7%
# ST	G>A	229	18.4%
# ST	G>C	0	0.0%
# ST	G>T	50	4.0%
# ST	T>A	0	0.0%
# ST	T>C	286	23.0%
# ST	T>G	76	6.1%
# # NS, Number of sites:
# NS	total        	1242
# NS	ref match    	1154	92.9%
# NS	ref mismatch 	88	7.1%
# NS	skipped      	0
# NS	non-ACGT     	0
# NS	non-SNP      	0
# NS	non-biallelic	0

####


bcftools +fixref AGP_Soy1K_PYT_2025_a6_v1.vcf -Oz -o AGP_Soy1K_PYT_2025_a6_v1_fixRef.vcf.gz -- -f ~/Desktop/Gmax_880_v6.0.fa -m flip

# # SC, guessed strand convention
# SC	TOP-compatible	0
# SC	BOT-compatible	0
# # ST, substitution types
# ST	A>C	53	4.3%
# ST	A>G	269	21.7%
# ST	A>T	0	0.0%
# ST	C>A	71	5.7%
# ST	C>G	0	0.0%
# ST	C>T	208	16.7%
# ST	G>A	229	18.4%
# ST	G>C	0	0.0%
# ST	G>T	50	4.0%
# ST	T>A	0	0.0%
# ST	T>C	286	23.0%
# ST	T>G	76	6.1%
# # NS, Number of sites:
# NS	total        	1242
# NS	ref match    	1154	92.9%
# NS	ref mismatch 	88	7.1%
# NS	flipped      	22	1.8%
# NS	swapped      	40	3.2%
# NS	flip+swap    	26	2.1%
# NS	unresolved   	0	0.0%
# NS	fixed pos    	0	0.0%
# NS	skipped      	0
# NS	non-ACGT     	0
# NS	non-SNP      	0
# NS	non-biallelic	0 

###


bcftools +fixref AGP_Soy1K_PYT_2025_a6_v1_fixRef.vcf.gz -- -f ~/Desktop/Gmax_880_v6.0.fa 

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





### Convert a1 to a4 
##### Read InfoCols from BARCSoySNP6K a4_v1 to a1_v1 mappings
# snp1K_a1_a4_v1 <- read.table("snp1KPos_a1_to_a4_mod5",header=F)
# dim(snp1K_a1_a4_v1)
# #[1] 1243    4
 
# ##### Extract a4_v1 coordinates from snp1K position mappings from Song's Group for 1K set
 
# snp1K_a1_a4_v1 <- droplevels(snp1K_a1_a4_v1)
# colnames( snp1K_a1_a4_v1) <-  c("Chrom.a1","Pos.a1","Chrom.a4","Pos.a4")
 
##### 

snp1K_pos_map <- read.csv("snp1k_pos_in_V4_Song_lab.csv",header=T)

# colnames(snp1K_pos_map)
# "ss.ID"                    "SNP.ID"                   "Reference.Allele"        
# [4] "Alternative.Allele"       "Glyma1.01.Chromosome."    "Glyma1.01.SNP.Position." 
# [7] "Wm82.a2.v1.Chromosome."   "Wm82.a2.v1.SNP.Position." "Wm82.a4.v1..Chromosome"  
# [10] "Wm82.a4.v1.SNP.Position"  "In.1K..Yes.null."  


 snp1KPos_a1_to_a4 <- snp1K_pos_map[,c("ss.ID","SNP.ID","Glyma1.01.Chromosome.","Glyma1.01.SNP.Position.","Wm82.a4.v1..Chromosome","Wm82.a4.v1.SNP.Position")]
 scaffoldInd <- grep("scaffold",snp1KPos_a1_to_a4$Wm82.a4.v1..Chromosome)
 nonNumInd <- grep("REF",snp1KPos_a1_to_a4$Wm82.a4.v1.SNP.Position)
 emptyPosInd <- which(snp1KPos_a1_to_a4$Wm82.a4.v1.SNP.Position == "")
 emptyChrInd <- which(snp1KPos_a1_to_a4$Wm82.a4.v1..Chromosome == "")
 rmInd <- c(scaffoldInd,nonNumInd,emptyPosInd,emptyChrInd)


 snp1KPos_a1_to_a4_mod <- snp1KPos_a1_to_a4[-rmInd,]
 snp1KPos_a1_to_a4_mod$Wm82.a4.v1.SNP.Position <- as.numeric(snp1KPos_a1_to_a4_mod$Wm82.a4.v1.SNP.Position)
 snp1KPos_a1_to_a4_mod$Wm82.a4.v1.SNP.Position 
  
 snp1K_a1_a4_v1 <- droplevels(snp1KPos_a1_to_a4_mod)
 colnames(snp1K_a1_a4_v1) <-  c("ssID","SNPID","Chrom.a1","Pos.a1","Chrom.a4","Pos.a4")
 snp1K_a1_a4_v1$ChrPosV1 <- paste(snp1K_a1_a4_v1$Chrom.a1,snp1K_a1_a4_v1$Pos.a1,sep="-") 
 colnames(snp1K_a1_a4_v1)
 
###
### 
  
 INFO_Cols_mod <-  INFO_Cols_Tab
 ChrPosInd <- which(colnames(INFO_Cols_mod) %in% "CHROM.POS")
 colnames(INFO_Cols_mod)[ChrPosInd] <- "ChrPosV1"
 
 INFO_Cols_mod$ChrPosV1 <- gsub("Gm[0]*","",INFO_Cols_mod$ChrPosV1) 
  
 
 dim(INFO_Cols_mod)
 #[1] 1242   10
 
 dim(snp1K_a1_a4_v1)
 #[1] 1243    6

 
 length(which(unique(snp1K_a1_a4_v1$ChrPosV1) %in% unique(INFO_Cols_mod$ChrPosV1)))

 missingSNPsChrPos_v1 <- setdiff(unique(snp1K_a1_a4_v1$ChrPosV1),unique(INFO_Cols_mod$ChrPosV1))
 missingSNPsChrPos_v2 <- setdiff(unique(INFO_Cols_mod$ChrPosV1),unique(snp1K_a1_a4_v1$ChrPosV1))


 snp1K_a1_a4_v1$ChrPosV1 <- gsub("Gm[0]*","",snp1K_a1_a4_v1$ChrPosV1)

##### Combine Info cols using a1_v1 coordinates 

 INFO_Cols_V0 <- merge(INFO_Cols_mod,snp1K_a1_a4_v1,by="ChrPosV1")
 INFO_Cols_V0$POS <- as.numeric(INFO_Cols_V0$POS)
 INFO_Cols_V1 <- INFO_Cols_V0[order(INFO_Cols_V0$CHROM,INFO_Cols_V0$POS),]

### a4 v1
 
 INFO_Cols_ModV2 <- INFO_Cols_V1[,c("ChrPosV1","Chrom.a4","Pos.a4","ID","REF","ALT","QUAL","FILTER","INFO","FORMAT")]
 colnames(INFO_Cols_ModV2)[1:6] <- c("CHROM.POS","CHROM","POS","ID","REF","ALT")
 
 
 ###
### Create INFO Cols Tab from 
 infoDupInd <- which(duplicated(INFO_Cols_ModV2$ID))
 if(length(infoDupInd)>0){INFO_Cols_Tab <- INFO_Cols_ModV2[-infoDupInd,]}else{INFO_Cols_Tab <- INFO_Cols_ModV2}
 
#
colnames(INFO_Cols_Tab)[1] <- "ChrPosV1"

AGP_Geno_Data_Out_Filt3$ChrPosV1 <- paste(AGP_Geno_Data_Out_Filt3$CHROM, AGP_Geno_Data_Out_Filt3$POS,sep="-")

AGP_QA0067_Geno_VCF <- merge(INFO_Cols_Tab,AGP_Geno_Data_Out_Filt3,by="ChrPosV1")

rmInd1 <- grep("\\.y",colnames(AGP_QA0067_Geno_VCF))
AGP_QA0067_Geno_Filt_VCF <- AGP_QA0067_Geno_VCF[,-c(1,rmInd1)]
colnames(AGP_QA0067_Geno_Filt_VCF) <- gsub("\\.x","",colnames(AGP_QA0067_Geno_Filt_VCF))

##
AGP_QA0067_Geno_Filt_VCF$POS <- as.numeric(AGP_QA0067_Geno_Filt_VCF$POS)
AGP_QA0067_Geno_Filt_VCF_Mod <- AGP_QA0067_Geno_Filt_VCF[order(AGP_QA0067_Geno_Filt_VCF$CHROM,AGP_QA0067_Geno_Filt_VCF$POS),]
dim(AGP_QA0067_Geno_Filt_VCF_Mod)

## This VCF has a1_v1 data with just the chrom/pos changed to a4_v1
OutFN4 <- paste("Lorenz_AGP_2024_Genotypes_a4_v1.vcf",sep="")
OutFN4

#Write header to file

writeLines(VCFHeader, OutFN4)

# Write column names to file
line1 <- paste("#", paste(colnames(AGP_QA0067_Geno_Filt_VCF_Mod), collapse = '\t'), sep = "")
cat(line1, file = OutFN4, append = TRUE, "\n")
write.table(AGP_QA0067_Geno_Filt_VCF_Mod,OutFN4,sep = "\t", col.names = FALSE, row.names = FALSE, quote=FALSE, append = TRUE)


####







snp1K_pos_map <- read.csv("snp1k_pos_in_V4_Song_lab.csv",header=T)

# colnames(snp1K_pos_map)
 # "ss.ID"                    "SNP.ID"                   "Reference.Allele"        
 # [4] "Alternative.Allele"       "Glyma1.01.Chromosome."    "Glyma1.01.SNP.Position." 
 # [7] "Wm82.a2.v1.Chromosome."   "Wm82.a2.v1.SNP.Position." "Wm82.a4.v1..Chromosome"  
# [10] "Wm82.a4.v1.SNP.Position"  "In.1K..Yes.null."  


 snp1KPos_a1_to_a4 <- snp1K_pos_map[,c("ss.ID","SNP.ID","Glyma1.01.Chromosome.","Glyma1.01.SNP.Position.","Wm82.a4.v1..Chromosome","Wm82.a4.v1.SNP.Position")]
 scaffoldInd <- grep("scaffold",snp1KPos_a1_to_a4$Wm82.a4.v1..Chromosome)
 nonNumInd <- grep("REF",snp1KPos_a1_to_a4$Wm82.a4.v1.SNP.Position)
 emptyPosInd <- which(snp1KPos_a1_to_a4$Wm82.a4.v1.SNP.Position == "")
 emptyChrInd <- which(snp1KPos_a1_to_a4$Wm82.a4.v1..Chromosome == "")
 rmInd <- c(scaffoldInd,nonNumInd,emptyPosInd,emptyChrInd)


 snp1KPos_a1_to_a4_mod <- snp1KPos_a1_to_a4[-rmInd,]
 snp1KPos_a1_to_a4_mod$Wm82.a4.v1.SNP.Position <- as.numeric(snp1KPos_a1_to_a4_mod$Wm82.a4.v1.SNP.Position)
 snp1KPos_a1_to_a4_mod$Wm82.a4.v1.SNP.Position 
  
 snp1K_a1_a4_v1 <- droplevels(snp1KPos_a1_to_a4_mod)
 colnames(snp1K_a1_a4_v1) <-  c("ssID","SNPID","Chrom.a1","Pos.a1","Chrom.a4","Pos.a4")
 snp1K_a1_a4_v1$ChrPosV1 <- paste(snp1K_a1_a4_v1$Chrom.a1,snp1K_a1_a4_v1$Pos.a1,sep="-") 
 colnames(snp1K_a1_a4_v1)
 
###
### 
  
 INFO_Cols_mod <-  INFO_Cols_Tab
 ChrPosInd <- which(colnames(INFO_Cols_mod) %in% "CHROM.POS")
 colnames(INFO_Cols_mod)[ChrPosInd] <- "ChrPosV1"
 
 INFO_Cols_mod$ChrPosV1 <- gsub("Gm[0]*","",INFO_Cols_mod$ChrPosV1) 
  
 
 dim(INFO_Cols_mod)
 #[1] 1242   10
 
 dim(snp1K_a1_a4_v1)
 #[1] 1243    6

 
 length(which(unique(snp1K_a1_a4_v1$ChrPosV1) %in% unique(INFO_Cols_mod$ChrPosV1)))

 missingSNPsChrPos_v1 <- setdiff(unique(snp1K_a1_a4_v1$ChrPosV1),unique(INFO_Cols_mod$ChrPosV1))
 missingSNPsChrPos_v2 <- setdiff(unique(INFO_Cols_mod$ChrPosV1),unique(snp1K_a1_a4_v1$ChrPosV1))


 snp1K_a1_a4_v1$ChrPosV1 <- gsub("Gm[0]*","",snp1K_a1_a4_v1$ChrPosV1)

##### Combine Info cols using a1_v1 coordinates 

 INFO_Cols_V0 <- merge(INFO_Cols_mod,snp1K_a1_a4_v1,by="ChrPosV1")
 INFO_Cols_V0$POS <- as.numeric(INFO_Cols_V0$POS)
 INFO_Cols_V1 <- INFO_Cols_V0[order(INFO_Cols_V0$CHROM,INFO_Cols_V0$POS),]

### a4 v1
 
 INFO_Cols_ModV2 <- INFO_Cols_V1[,c("ChrPosV1","Chrom.a4","Pos.a4","ID","REF","ALT","QUAL","FILTER","INFO","FORMAT")]
 colnames(INFO_Cols_ModV2)[1:6] <- c("CHROM.POS","CHROM","POS","ID","REF","ALT")
 
 
 ###
### Create INFO Cols Tab from 
 infoDupInd <- which(duplicated(INFO_Cols_ModV2$ID))
 if(length(infoDupInd)>0){INFO_Cols_Tab <- INFO_Cols_ModV2[-infoDupInd,]}else{INFO_Cols_Tab <- INFO_Cols_ModV2}
 
#
colnames(INFO_Cols_Tab)[1] <- "ChrPosV1"

AGP_Geno_Data_Out_Filt3$ChrPosV1 <- paste(AGP_Geno_Data_Out_Filt3$CHROM, AGP_Geno_Data_Out_Filt3$POS,sep="-")

AGP_QA0067_Geno_VCF <- merge(INFO_Cols_Tab,AGP_Geno_Data_Out_Filt3,by="ChrPosV1")

rmInd1 <- grep("\\.y",colnames(AGP_QA0067_Geno_VCF))
AGP_QA0067_Geno_Filt_VCF <- AGP_QA0067_Geno_VCF[,-c(1,rmInd1)]
colnames(AGP_QA0067_Geno_Filt_VCF) <- gsub("\\.x","",colnames(AGP_QA0067_Geno_Filt_VCF))

##
AGP_QA0067_Geno_Filt_VCF$POS <- as.numeric(AGP_QA0067_Geno_Filt_VCF$POS)
AGP_QA0067_Geno_Filt_VCF_Mod <- AGP_QA0067_Geno_Filt_VCF[order(AGP_QA0067_Geno_Filt_VCF$CHROM,AGP_QA0067_Geno_Filt_VCF$POS),]
dim(AGP_QA0067_Geno_Filt_VCF_Mod)

## This VCF has a1_v1 data with just the chrom/pos changed to a4_v1
OutFN4 <- paste("Lorenz_AGP_2024_Genotypes_a4_v1.vcf",sep="")
OutFN4

#Write header to file

writeLines(VCFHeader, OutFN4)

# Write column names to file
line1 <- paste("#", paste(colnames(AGP_QA0067_Geno_Filt_VCF_Mod), collapse = '\t'), sep = "")
cat(line1, file = OutFN4, append = TRUE, "\n")
write.table(AGP_QA0067_Geno_Filt_VCF_Mod,OutFN4,sep = "\t", col.names = FALSE, row.names = FALSE, quote=FALSE, append = TRUE)


###
module load bcftools
bgzip Lorenz_AGP_2024_Genotypes_a4_v1.vcf
bcftools stats Lorenz_AGP_2024_Genotypes_a4_v1.vcf.gz > Lorenz_AGP_2024_Geno_Stats

bcftools tabix Lorenz_AGP_2024_Genotypes_a4_v1.vcf.gz

#### Performing - norm with check-ref leads to several issues such as addition of multiple ALT multi-allelic sites 


bcftools +fixref input.vcf.gz \
  -- -f reference.fasta \
  -m flip \
  -Ov -o flipped.vcf
  
  
bcftools +fixref  Lorenz_AGP_2024_Genotypes_a4_v1.vcf.gz -Oz -o Lorenz_AGP_2024_Genotypes_a4_v1_Flip.vcf.gz -- -f ../Gmax_508_v4.0.fa -m flip 
# SC, guessed strand convention
SC	TOP-compatible	0
SC	BOT-compatible	0
# ST, substitution types
ST	A>C	53	4.3%
ST	A>G	263	21.6%
ST	A>T	0	0.0%
ST	C>A	70	5.7%
ST	C>G	0	0.0%
ST	C>T	202	16.6%
ST	G>A	227	18.6%
ST	G>C	0	0.0%
ST	G>T	50	4.1%
ST	T>A	0	0.0%
ST	T>C	279	22.9%
ST	T>G	76	6.2%
# NS, Number of sites:
NS	total        	1220
NS	ref match    	305	25.0%
NS	ref mismatch 	915	75.0%
NS	flipped      	313	25.7%
NS	swapped      	308	25.2%
NS	flip+swap    	294	24.1%
NS	unresolved   	0	0.0%
NS	fixed pos    	0	0.0%
NS	skipped      	0
NS	non-ACGT     	0
NS	non-SNP      	0
NS	non-biallelic	0
 



bcftools +fixref  Lorenz_AGP_2024_Genotypes_a4_v1_Flip.vcf.gz \
    -- -f ../Gmax_508_v4.0.fa 
# SC, guessed strand convention
SC	TOP-compatible	0
SC	BOT-compatible	0
# ST, substitution types
ST	A>C	53	4.3%
ST	A>G	263	21.6%
ST	A>T	0	0.0%
ST	C>A	70	5.7%
ST	C>G	0	0.0%
ST	C>T	202	16.6%
ST	G>A	227	18.6%
ST	G>C	0	0.0%
ST	G>T	50	4.1%
ST	T>A	0	0.0%
ST	T>C	279	22.9%
ST	T>G	76	6.2%
# NS, Number of sites:
NS	total        	1220
NS	ref match    	305	25.0%
NS	ref mismatch 	915	75.0%
NS	skipped      	0
NS	non-ACGT     	0

bcftools norm --check-ref e -f ../Gmax_508_v4.0.fa Lorenz_AGP_2024_Genotypes_a4_v1.vcf.gz -Ou -o /dev/null 


bcftools view -m2 -M2 -v snps Lorenz_AGP_2024_Genotypes_a4_v1.vcf.gz -Oz -o Lorenz_AGP_2024_Genotypes_a4_v1_snps.vcf.gz 


bcftools +fixref  Lorenz_AGP_2024_Genotypes_a4_v1.vcf.gz -Oz -o Lorenz_AGP_2024_Genotypes_a4_v1_Flip.vcf.gz -- -f ../Gmax_508_v4.0.fa -m flip 





bcftools norm --check-ref ws -f ../Gmax_508_v4.0.fa Lorenz_AGP_2024_Genotypes_a4_v1.vcf.gz -o Lorenz_AGP_2024_Genotypes_a4_v1_Checked.vcf.gz -Oz
# Lines   total/split/realigned/skipped:	1220/0/0/0
# REF/ALT total/modified/added:  	1220/308/607

bcftools norm --check-ref x -f ../Gmax_508_v4.0.fa Lorenz_AGP_2024_Genotypes_a4_v1.vcf.gz -o Lorenz_AGP_2024_Genotypes_a4_v1_Checked_Exc.vcf.gz -Oz

# Lines   total/split/realigned/skipped:	1220/0/0/915
# Records - N	0	number of samples:	1553
# SN	0	number of records:	305
# SN	0	number of no-ALTs:	0
# SN	0	number of SNPs:	305


# Pyt24_Tab_Std2 is a merged infocols table with
# Chr/Pos/REf/Alt from 1K_pre-refcheck, 1kRefcheck-swapped and 1K subset from 50KGencove 

length(which(Pyt24_Tab_Std2[,"REF.A4-1K"]==Pyt24_Tab_Std2[,"REF.A4.Pre"]))
#[1] 295
 
length(which(Pyt24_Tab_Std2[,"ALT.A4-1K"]==Pyt24_Tab_Std2[,"ALT.A4.Pre"]))
#[1] 295

###############
##unchanged REF 
length(which(Pyt24_Tab_Std2[,"REF.A4-1K"]==Pyt24_Tab_Std2[,"REF.A4.Pre"]))
#[1] 295

##Unchanged ALT 
length(which(Pyt24_Tab_Std2[,"ALT.A4-1K"]==Pyt24_Tab_Std2[,"ALT.A4.Pre"]))
#[1] 295


## # Swaps 
length(which(Pyt24_Tab_Std2[,"REF.A4-1K"]==Pyt24_Tab_Std2[,"ALT.A4.Pre"]))
#[1] 300

length(which(Pyt24_Tab_Std2[,"ALT.A4-1K"]==Pyt24_Tab_Std2[,"REF.A4.Pre"]))
#[1] 300

Pyt24_Tab_Std2


## bcftools norm - D -- to remove duplicaes
##

bcftools query -f "%CHROM\t%POS\t%REF\t%ALT\n" AGP_PYT_2024_Genotypes_a1_v1.vcf.gz > AGP_PYT_2024_CHRPOS

bcftools stats Lorenz_AGP_2024_Genotypes_a4_v1_Checked.vcf.gz > Lorenz_AGP_2024_Geno_a4_v1_Stats 

bcftools query -f "%CHROM\t%POS\t%REF\t%ALT\n" Lorenz_AGP_2024_Genotypes_a4_v1_Checked.vcf.gz > Lorenz_AGP_2024_ChrPos


bcftools view -S 20CBSamples_Gencove_2023Data Gencove_2023_Merged_Norm_MultialleleAny_SNPS_50K.vcf.gz -o CxB2020_Gencove_SNP50K_Norm_M.vcf.gz -Oz 

bcftools stats CxB2020_Gencove_SNP50K_Norm_M.vcf.gz > CxB20_Gcve_50K_Stats

bcftools query -f "%CHROM\t%POS\t%REF\t%ALT\n" CxB2020_Gencove_SNP50K_Norm_M.vcf.gz > CxB2020_Gcve_50K_ChrPos  


bcftools view -S PYT2024_Samples Lorenz_AGP_2024_Genotypes_a4_v1.vcf.gz -o Lorenz_AGP_PYT_2024_Genotypes_a4_v1.vcf.gz -Oz
bcftools stats Lorenz_AGP_PYT_2024_Genotypes_a4_v1.vcf.gz > Lorenz_PYT_2024_A4_V1

bcftools norm --check-ref ws -f ../Gmax_508_v4.0.fa Lorenz_AGP_PYT_2024_Genotypes_a4_v1.vcf.gz -o Lorenz_AGP_PYT_2024_Genotypes_a4_v1_Checked.vcf.gz -Oz
Lines   total/split/realigned/skipped:	1220/0/0/0
REF/ALT total/modified/added:  	1220/308/607

Lorenz_AGP_PYT_2024_Genotypes_a4_v1_Checked.vcf.gz








## This VCF has a1_v1 data with just the chrom/pos changed to a4_v1
OutFN4 <- paste("Lorenz_AGP_2024_Genotypes_a4_v1.vcf",sep="")
OutFN4

#Write header to file

writeLines(VCFHeader, OutFN4)

# Write column names to file
line1 <- paste("#", paste(colnames(AGP_QA0067_Geno_Filt_VCF_Mod), collapse = '\t'), sep = "")
cat(line1, file = OutFN4, append = TRUE, "\n")
write.table(AGP_QA0067_Geno_Filt_VCF_Mod,OutFN4,sep = "\t", col.names = FALSE, row.names = FALSE, quote=FALSE, append = TRUE)


####

