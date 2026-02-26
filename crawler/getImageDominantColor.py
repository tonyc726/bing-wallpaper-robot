from __future__ import print_function
# https://stackoverflow.com/questions/3241929/python-find-dominant-most-common-color-in-an-image
import binascii
import numpy as np
import scipy.cluster
from collections import Counter


def findDominantMostCommonColorInAnImageFile(image):
    NUM_CLUSTERS = 5
    ar = np.asarray(image)
    shape = ar.shape
    # Fix: Use numpy.prod instead of scipy.product
    ar = ar.reshape(np.prod(shape[:2]), shape[2]).astype(float)
    # print('finding clusters')
    codes, dist = scipy.cluster.vq.kmeans(ar, NUM_CLUSTERS)
    # print('cluster centres:\n', codes)
    vecs, dist = scipy.cluster.vq.vq(ar, codes)         # assign codes
    # Fix: Use Counter instead of scipy.histogram
    counts = Counter(vecs)                              # count occurrences
    index_max = counts.most_common(1)[0][0]             # find most frequent
    peak = codes[index_max]
    colour = binascii.hexlify(bytearray(int(c) for c in peak)).decode('ascii')
    return colour
